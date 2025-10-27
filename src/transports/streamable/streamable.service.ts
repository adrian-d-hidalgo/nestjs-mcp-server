import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response } from 'express';

import { McpModuleTransportOptions, McpServerOptions } from '../../mcp.types';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';

@Injectable()
export class StreamableService implements OnModuleInit {
  private server: McpServer;

  constructor(
    @Inject('MCP_SERVER_OPTIONS')
    private readonly options: McpServerOptions,
    @Inject('MCP_TRANSPORT_OPTIONS')
    private readonly transportOptions: McpModuleTransportOptions,
    private readonly registry: RegistryService,
    private readonly logger: McpLoggerService,
    private readonly asyncLocalStorage: AsyncLocalStorage<Request>,
  ) {
    this.server = new McpServer(this.options.serverInfo, this.options.options);
  }

  async onModuleInit() {
    await this.registry.registerAll(this.server);
    this.logger.log('MCP STREAMABLE initialization completed');
  }

  async handlePostRequest(req: Request, res: Response) {
    await this.asyncLocalStorage.run(req, async () => {
      try {
        const { options } = this.transportOptions?.streamable || {};
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: options?.enableJsonResponse ?? true,
        });

        res.on('close', () => {
          transport.close();
        });

        await this.server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        this.logger.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: null,
          });
        }
      }
    });
  }
}
