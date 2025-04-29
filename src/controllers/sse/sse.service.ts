import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Request, Response } from 'express';

import { McpServerOptions } from '../../interfaces/mcp-server-options.interface';
import { McpLoggerService } from '../../registry/logger.service';
import { RegistryService } from '../../registry/registry.service';

@Injectable()
export class SseService implements OnModuleInit {
  private server: McpServer;

  private transports = {} as Record<string, SSEServerTransport>;

  constructor(
    @Inject('MCP_SERVER_OPTIONS')
    private readonly options: McpServerOptions,
    private readonly registry: RegistryService,
    private readonly logger: McpLoggerService,
  ) {
    this.server = new McpServer(this.options.serverInfo, this.options.options);
  }

  async onModuleInit() {
    this.logger.log('Starting MCP controller registration', 'MCP_SERVER');
    await this.registry.registerAll(this.server);
    this.logger.log('MCP initialization completed', 'MCP_SERVER');
  }

  /**
   * Handle an SSE request for server-sent events
   *
   * This establishes a connection for server-to-client notifications
   */
  async handleSse(req: Request, res: Response) {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    this.transports[transport.sessionId] = transport;

    this.logger.debug(
      `Starting SSE for sessionId: ${transport.sessionId}`,
      'api',
    );

    res.on('close', () => {
      delete this.transports[transport.sessionId];
    });

    await this.server.connect(transport);
  }

  /**
   * Handle SSE messages sent from client to server
   */
  async handleMessage(req: Request, res: Response) {
    const sessionId = req.query.sessionId as string;
    const transport = this.transports[sessionId];

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

      res.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: errorMessage,
      });
    }
  }
}
