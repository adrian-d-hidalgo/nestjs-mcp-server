import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

import {
  McpModuleTransportOptions,
  McpServerOptions,
} from '../../interfaces/mcp-server-options.interface';
import { McpLoggerService } from '../../registry/logger.service';
import { RegistryService } from '../../registry/registry.service';

// TODO: Stateless mode should be handled here or in another service

@Injectable()
export class StreamableService implements OnModuleInit {
  private server: McpServer;

  private transports = {} as Record<string, StreamableHTTPServerTransport>;

  constructor(
    @Inject('MCP_SERVER_OPTIONS')
    private readonly options: McpServerOptions,
    @Inject('MCP_TRANSPORT_OPTIONS')
    private readonly transportOptions: McpModuleTransportOptions,
    private readonly registry: RegistryService,
    private readonly logger: McpLoggerService,
  ) {
    this.server = new McpServer(this.options.serverInfo, this.options.options);
  }

  async onModuleInit() {
    await this.registry.registerAll(this.server);

    this.logger.log('MCP STREAMEABLE initialization completed');
  }

  /**
   * Handle a streamable HTTP POST request from a client
   *
   * - Uses sessionId from query or generates a new one if missing
   * - Stores the transport by sessionId for later retrieval
   * - Cleans up transport on connection close
   *
   * @param req Express Request object (expects sessionId in query)
   * @param res Express Response object
   */
  async handlePostRequest(
    req: Request<any, any, any, { sessionId?: string }>,
    res: Response,
  ) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    const { options } = this.transportOptions?.streamable || {};

    if (sessionId && this.transports[sessionId]) {
      transport = this.transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () =>
          options?.sessionIdGenerator?.() || randomUUID(),
        onsessioninitialized: (sessionId) => {
          this.transports[sessionId] = transport;
        },
        enableJsonResponse: options?.enableJsonResponse,
        eventStore: options?.eventStore,
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete this.transports[transport.sessionId];
        }
      };
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });

      return;
    }

    await transport.handleRequest(req, res, req.body);
  }

  /**
   * Handle a streamable HTTP GET request from a client
   *
   * This method retrieves the existing streamable transport for the session and delegates the request.
   *
   * @param req Express Request object (expects sessionId in query)
   * @param res Express Response object
   */
  async handleGetRequest(
    req: Request<any, any, any, { sessionId?: string }>,
    res: Response,
  ) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = this.transports[sessionId];

    await transport.handleRequest(req, res);
  }

  /**
   * Handle a streamable HTTP DELETE request to clean up a session
   *
   * - Accepts sessionId from query or x-mcp-session-id header
   * - Closes and removes the transport if found
   * - Always sends a response
   *
   * @param req Express Request object
   * @param res Express Response object
   */
  async handleDeleteRequest(
    req: Request<any, any, any, { sessionId?: string }>,
    res: Response,
  ) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const transport = this.transports[sessionId];

    if (transport) {
      this.logger.debug(
        `Closing streamable transport for sessionId: ${sessionId}`,
        'STREAMABLE',
      );
      await transport.close();
      delete this.transports[sessionId];
      res.status(200).json({ success: true, sessionId });
    } else {
      this.logger.debug(
        `No streamable transport found for sessionId: ${sessionId}`,
        'STREAMABLE',
      );
      res.status(404).json({ error: 'Transport not found', sessionId });
    }
  }
}
