import type {
  McpHttpHandler,
  McpRequestContext,
  ServerNotifier,
} from '@modelcontextprotocol/server';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../interfaces/handler-context.interface';
import {
  MCP_REQUEST_SCOPE,
  MCP_SERVER_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
} from '../../mcp.constants';
import type { McpServerOptions, McpTransportOptions } from '../../mcp.types';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';

/** What travels across the SDK handler from the controller to the factory. */
export interface McpRequestScope {
  request: AuthenticatedRequest;
}

/**
 * The single stateless MCP endpoint.
 *
 * One {@link McpHttpHandler} exists for the application's lifetime; the SDK
 * calls our factory to build a fresh `McpServer` for **every HTTP request**.
 * Nothing is retained between requests, which is what lets instances sit behind
 * a round-robin load balancer with no sticky routing and no shared session
 * store.
 *
 * ### Why `AsyncLocalStorage`
 *
 * The SDK's factory context ({@link McpRequestContext}) carries a
 * web-standard `Request`, not Express's. That is enough for headers and a URL,
 * but it has no `req.ip`, no `req.cookies`, no `req.user`, no route params, and
 * nothing a Nest middleware or interceptor attached upstream — all of which
 * guards and capability gates legitimately read. So the Express request travels
 * out-of-band.
 *
 * The surface is deliberately tiny: exactly one `run()` here and one
 * `getStore()` in the factory. Everything downstream — `registerAll`, the
 * handler closures, the guards — captures the object the factory built, so no
 * async boundary is ever crossed with a `getStore()` call.
 *
 * Alternatives considered and rejected: building a handler per request (defeats
 * the `maxSubscriptions` cap and leaves `close()` with nothing to tear down),
 * and a `WeakMap` keyed on the web `Request` (the SDK clones the request when
 * no parsed body is supplied, so it silently loses the entry whenever a
 * consumer bootstraps with `bodyParser: false`).
 */
@Injectable()
export class McpHttpService implements OnModuleInit, OnApplicationShutdown {
  private handler!: McpHttpHandler;
  private nodeHandler!: ReturnType<typeof toNodeHandler>;

  constructor(
    @Inject(MCP_SERVER_OPTIONS)
    private readonly options: McpServerOptions,
    @Inject(MCP_TRANSPORT_OPTIONS)
    private readonly transportOptions: McpTransportOptions | undefined,
    @Inject(MCP_REQUEST_SCOPE)
    private readonly als: AsyncLocalStorage<McpRequestScope>,
    private readonly registry: RegistryService,
    private readonly logger: McpLoggerService,
  ) {}

  onModuleInit(): void {
    this.handler = createMcpHandler((ctx) => this.createServer(ctx), {
      // `legacy: 'stateless'` is the SDK default and is what keeps existing
      // clients working: every published MCP client SDK still speaks the
      // 2025 era. A consumer can opt into `'reject'` for modern-only.
      ...(this.transportOptions ?? {}),
      onerror: (error) =>
        this.logger.error(error.message, error.stack, 'MCP_SERVER'),
    });

    this.nodeHandler = toNodeHandler(this.handler);

    this.logger.log('MCP stateless endpoint initialized', 'MCP_SERVER');
  }

  onApplicationShutdown(): Promise<void> {
    return this.handler?.close() ?? Promise.resolve();
  }

  /**
   * Serves one HTTP request.
   *
   * `req.body` is handed to the SDK as the pre-parsed body so it never has to
   * re-read (or clone) the already-drained Node stream.
   */
  handle(req: AuthenticatedRequest, res: Response): Promise<void> {
    return this.als.run({ request: req }, () =>
      this.nodeHandler(req, res, req.body),
    );
  }

  /**
   * Publishes change events onto open `subscriptions/listen` streams.
   */
  get notify(): ServerNotifier {
    return this.handler.notify;
  }

  /**
   * Builds the `McpServer` for one request.
   *
   * Fails closed if the request scope is missing: serving without it would
   * degrade every capability gate to its fail-closed branch and hand guards an
   * undefined request, which is a silent authorization change. A loud failure
   * is the correct outcome.
   */
  private async createServer(ctx: McpRequestContext): Promise<McpServer> {
    const scope = this.als.getStore();

    if (!scope) {
      throw new Error(
        'MCP request scope unavailable: the server factory ran outside the request context.',
      );
    }

    const server = new McpServer(this.options.serverInfo, this.options.options);

    await this.registry.registerAll(server, {
      request: scope.request,
      authInfo: ctx.authInfo ?? scope.request.auth,
      era: ctx.era,
    });

    return server;
  }
}
