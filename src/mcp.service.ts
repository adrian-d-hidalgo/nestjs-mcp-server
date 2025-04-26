/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Inject, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

import { McpServerOptions } from './interfaces/mcp-server-options.interface';
import { McpRegistry } from './registry/mcp.registry';
import { McpLoggerService } from './registry/mcp-logger.service';

@Injectable()
export class McpService {
  private server: McpServer;

  private transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>,
  };

  constructor(
    @Inject('MCP_SERVER_OPTIONS')
    private readonly options: McpServerOptions,
    private readonly registry: McpRegistry,
    private readonly logger: McpLoggerService,
  ) {
    this.server = new McpServer(this.options.serverInfo, this.options.options);

    this.logger.log('Starting MCP controller registration', 'MCP_SERVER');

    this.registry.registerAll(this.server);

    this.logger.log('MCP initialization completed', 'MCP_SERVER');
  }

  /**
   * Handle a streamable HTTP request from a client
   *
   * This method processes standard HTTP POST/GET/DELETE requests
   * for the streamable HTTP transport.
   */
  async handleStreamableRequest(req: Request, res: Response) {
    // In a complete implementation, you would integrate with the StreamableHTTPServerTransport
    // const transport = new StreamableHTTPServerTransport();
    // await this.server.connect(transport);
    // await transport.handleRequest(req, res, body);

    // For now, we return a basic JSON-RPC response
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (!res.headersSent) {
      res.json({
        jsonrpc: '2.0',
        result: { status: 'ok' },
        id: req.body?.id || null,
      });
    }
  }

  /**
   * Handle an SSE request for server-sent events
   *
   * This establishes a connection for server-to-client notifications
   */
  async handleSSERequest(req: Request, res: Response) {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    this.transports.sse[transport.sessionId] = transport;

    this.logger.debug(
      `Starting SSE for sessionId: ${transport.sessionId}`,
      'api',
    );

    res.on('close', () => {
      delete this.transports.sse[transport.sessionId];
    });

    await this.server.connect(transport);
  }

  /**
   * Handle SSE messages sent from client to server
   */
  async handleSSEMessage(req: Request, res: Response) {
    const sessionId = req.query.sessionId as string;
    const transport = this.transports.sse[sessionId];

    this.logger.debug(
      `Receiving SSE message for sessionId: ${sessionId}`,
      'api',
    );

    this.logger.debug(`SSE message: ${JSON.stringify(req.body)}`, 'MCP_SERVER');

    try {
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        'Error al manejar mensaje SSE',
        errorMessage,
        'MCP_SERVER',
      );
      res.status(500).send(errorMessage);
    }
  }

  /**
   * Get the MCP server instance
   */
  getServer(): McpServer {
    return this.server;
  }
}
