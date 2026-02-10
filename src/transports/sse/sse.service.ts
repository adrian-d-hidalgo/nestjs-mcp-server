import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Request, Response } from 'express';

import {
  MCP_SERVER_OPTIONS,
  MCP_SESSION_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
} from '../../mcp.constants';
import {
  McpModuleTransportOptions,
  McpServerOptions,
  McpSessionOptions,
} from '../../mcp.types';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import { SessionManager } from '../../services/session.manager';

@Injectable()
export class SseService implements OnModuleInit {
  private readonly sessionTimeoutMs: number;
  private readonly maxConcurrentSessions: number;
  private readonly cleanupIntervalMs: number;
  private readonly enabled: boolean;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @Inject(MCP_SERVER_OPTIONS)
    private readonly options: McpServerOptions,
    @Inject(MCP_SESSION_OPTIONS)
    private readonly sessionOptions: McpSessionOptions,
    @Inject(MCP_TRANSPORT_OPTIONS)
    private readonly transportOptions: McpModuleTransportOptions,
    private readonly registry: RegistryService,
    private readonly logger: McpLoggerService,
    private readonly sessionManager: SessionManager,
  ) {
    // Check if SSE transport is enabled (default: true)
    this.enabled = transportOptions?.sse?.enabled !== false;

    // Initialize with config values or defaults
    this.sessionTimeoutMs = sessionOptions.sessionTimeoutMs ?? 1800000;
    this.maxConcurrentSessions = sessionOptions.maxConcurrentSessions ?? 1000;
    this.cleanupIntervalMs = sessionOptions.cleanupIntervalMs ?? 300000;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('SSE transport disabled', 'MCP_SERVER');
      return;
    }

    this.logger.log('MCP initialization completed', 'MCP_SERVER');
    this.startCleanupJob();
  }

  onModuleDestroy() {
    this.stopCleanupJob();
  }

  private startCleanupJob(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveSessions();
    }, this.cleanupIntervalMs);
  }

  private stopCleanupJob(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  private cleanupInactiveSessions(): void {
    const inactiveSessions = this.sessionManager.getInactiveSessions(
      this.sessionTimeoutMs,
    );

    if (inactiveSessions.length > 0) {
      this.logger.debug(
        `Cleaning up ${inactiveSessions.length} inactive sessions`,
        'SSE',
      );

      for (const sessionId of inactiveSessions) {
        const session = this.sessionManager.getSession(sessionId);
        if (session) {
          try {
            void session.transport.close();
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Error closing transport for session ${sessionId}`,
              errorMessage,
              'SSE',
            );
          }
          this.sessionManager.deleteSession(sessionId);
        }
      }
    }
  }

  private createServer(): McpServer {
    const server = new McpServer(this.options.serverInfo, this.options.options);
    this.registry.registerAll(server);
    return server;
  }

  /**
   * Handle an SSE request for server-sent events
   *
   * This establishes a connection for server-to-client notifications
   */
  async handleSse(req: Request, res: Response) {
    if (!this.enabled) {
      res.status(404).send('SSE transport is disabled');
      return;
    }

    // Check session limit
    if (
      this.sessionManager.getActiveSessionCount() >= this.maxConcurrentSessions
    ) {
      this.logger.warn(
        `Maximum concurrent sessions reached: ${this.maxConcurrentSessions}`,
        'SSE',
      );
      res
        .status(503)
        .send(
          'Service temporarily unavailable: Maximum concurrent sessions reached',
        );
      return;
    }

    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);

    this.sessionManager.setSession(transport.sessionId, {
      transport,
      request: req,
    });

    this.logger.debug(
      `Starting SSE for sessionId: ${transport.sessionId}`,
      'SSE',
    );

    res.on('close', () => {
      this.logger.debug(
        `SSE connection closed for session: ${transport.sessionId}`,
        'SSE',
      );
      this.sessionManager.deleteSession(transport.sessionId);
    });

    try {
      const server = this.createServer();
      await server.connect(transport);
    } catch (error) {
      this.logger.error('Failed to create or connect server', error, 'SSE');
      this.sessionManager.deleteSession(transport.sessionId);
      res.status(500).send('Internal server error');
    }
  }

  /**
   * Handle SSE messages sent from client to server
   */
  async handleMessage(req: Request, res: Response) {
    if (!this.enabled) {
      res.status(404).send('SSE transport is disabled');
      return;
    }

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
