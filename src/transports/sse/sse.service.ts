import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Request, Response } from 'express';

import { McpServerOptions } from '../../mcp.types';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import { SessionManager } from '../../services/session.manager';

@Injectable()
export class SseService implements OnModuleInit {
  private server: McpServer;

  constructor(
    @Inject('MCP_SERVER_OPTIONS')
    private readonly options: McpServerOptions,
    private readonly registry: RegistryService,
    private readonly logger: McpLoggerService,
    private readonly sessionManager: SessionManager,
  ) {
    this.server = new McpServer(this.options.serverInfo, this.options.options);
  }

  onModuleInit() {
    this.logger.log('Starting MCP controller registration', 'MCP_SERVER');
    this.registry.registerAll(this.server);
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

    this.sessionManager.setSession(transport.sessionId, {
      transport,
      request: req,
    });

    this.logger.debug(
      `Starting SSE for sessionId: ${transport.sessionId}`,
      'api',
    );

    res.on('close', () => {
      this.sessionManager.deleteSession(transport.sessionId);
    });

    await this.server.connect(transport);
  }

  /**
   * Handle SSE messages sent from client to server
   */
  async handleMessage(req: Request, res: Response) {
    const sessionId = req.query.sessionId as string;
    const session = this.sessionManager.getSession(sessionId);

    if (!session) {
      res.status(400).send('Invalid or missing sessionId');
      return;
    }

    this.logger.debug(
      `Receiving SSE message for sessionId: ${sessionId}`,
      'api',
    );

    this.logger.debug(`SSE message: ${JSON.stringify(req.body)}`, 'MCP_SERVER');

    const transport = session.transport;

    if (!(transport instanceof SSEServerTransport)) {
      res.status(400).send('Invalid transport');
      return;
    }

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
