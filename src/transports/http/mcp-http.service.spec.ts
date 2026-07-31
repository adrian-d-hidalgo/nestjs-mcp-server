// `expect.objectContaining` is typed `any`; nesting one inside another trips
// the rule with no way to annotate it. Same suppression as registry.service.spec.
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { AuthInfo, McpRequestContext } from '@modelcontextprotocol/server';
import { AsyncLocalStorage } from 'async_hooks';
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../interfaces/handler-context.interface';
import type { McpServerOptions, McpTransportOptions } from '../../mcp.types';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import type { McpRequestScope } from './mcp-http.service';
import { McpHttpService } from './mcp-http.service';

/** Narrow access to the private members these tests drive. */
type Internals = {
  createServer: (ctx: McpRequestContext) => Promise<unknown>;
  nodeHandler: jest.Mock;
};
const internals = (s: McpHttpService): Internals => s as unknown as Internals;

const createRequest = (
  headers: Record<string, string> = {},
): AuthenticatedRequest =>
  ({ headers, body: { jsonrpc: '2.0' } }) as unknown as AuthenticatedRequest;

const createResponse = (): Response =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }) as unknown as Response;

const sdkContext = (
  overrides: Partial<McpRequestContext> = {},
): McpRequestContext =>
  ({ era: 'modern', ...overrides }) as unknown as McpRequestContext;

describe('McpHttpService', () => {
  let als: AsyncLocalStorage<McpRequestScope>;
  let registry: { registerAll: jest.Mock };
  let logger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
  let service: McpHttpService;

  const serverOptions: McpServerOptions = {
    serverInfo: { name: 'test', version: '1.0.0' },
    options: {},
  };

  const build = (transportOptions?: McpTransportOptions) => {
    als = new AsyncLocalStorage<McpRequestScope>();
    registry = { registerAll: jest.fn().mockResolvedValue(undefined) };
    logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };

    return new McpHttpService(
      serverOptions,
      transportOptions,
      als,
      registry as unknown as RegistryService,
      logger as unknown as McpLoggerService,
    );
  };

  beforeEach(() => {
    service = build();
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
  });

  describe('onModuleInit', () => {
    it('builds a single handler for the application lifetime', () => {
      service.onModuleInit();

      // One handler, not one per request: the SDK's `maxSubscriptions` cap is
      // per handler, and `close()` needs something to tear down.
      expect(service.notify).toBeDefined();
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('stateless'),
        'MCP_SERVER',
      );
    });

    it('accepts transport options without throwing', () => {
      service = build({ legacy: 'reject' });

      expect(() => service.onModuleInit()).not.toThrow();
    });
  });

  describe('notify', () => {
    it('exposes the handler’s change-event facade', () => {
      service.onModuleInit();

      // The only route this library has to `notifications/*/list_changed`:
      // publish onto the handler's `subscriptions/listen` bus. Safe to call
      // with no subscriber open — it is a documented no-op.
      expect(typeof service.notify.toolsChanged).toBe('function');
      expect(() => service.notify.toolsChanged()).not.toThrow();
    });
  });

  describe('createServer', () => {
    it('fails closed when no request scope is present', async () => {
      service.onModuleInit();

      // Serving without the request would degrade every capability gate to its
      // fail-closed branch and hand guards an undefined request — a silent
      // authorization change. A loud failure is the correct outcome.
      await expect(
        internals(service).createServer(sdkContext()),
      ).rejects.toThrow(/request scope unavailable/i);
    });

    it('registers capabilities against the scoped request', async () => {
      service.onModuleInit();
      const request = createRequest({ 'x-role': 'admin' });

      await als.run({ request }, async () => {
        await internals(service).createServer(sdkContext());
      });

      expect(registry.registerAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ request, era: 'modern' }),
      );
    });

    it('prefers the authInfo the SDK validated over req.auth', async () => {
      service.onModuleInit();
      const request = createRequest();
      request.auth = {
        clientId: 'from-request',
        token: 'request-token',
        scopes: [],
      };
      const authInfo: AuthInfo = {
        clientId: 'from-sdk',
        token: 'sdk-token',
        scopes: [],
      };

      await als.run({ request }, async () => {
        await internals(service).createServer(sdkContext({ authInfo }));
      });

      expect(registry.registerAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ authInfo }),
      );
    });

    it('falls back to req.auth when the SDK supplied none', async () => {
      service.onModuleInit();
      const request = createRequest();
      request.auth = {
        clientId: 'from-request',
        token: 'request-token',
        scopes: [],
      };

      await als.run({ request }, async () => {
        await internals(service).createServer(sdkContext());
      });

      expect(registry.registerAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          authInfo: expect.objectContaining({ clientId: 'from-request' }),
        }),
      );
    });

    it('propagates the protocol era so gates can branch on it', async () => {
      service.onModuleInit();
      const request = createRequest();

      await als.run({ request }, async () => {
        await internals(service).createServer(sdkContext({ era: 'legacy' }));
      });

      expect(registry.registerAll).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ era: 'legacy' }),
      );
    });
  });

  describe('handle', () => {
    it('runs the SDK handler inside the request scope', async () => {
      service.onModuleInit();
      const request = createRequest();
      const response = createResponse();

      let seen: McpRequestScope | undefined;
      internals(service).nodeHandler = jest.fn(() => {
        seen = als.getStore();
        return Promise.resolve();
      });

      await service.handle(request, response);

      // This is the whole mechanism: the Express request reaches the factory
      // out-of-band, because the SDK's own factory context carries only a
      // web-standard Request.
      expect(seen?.request).toBe(request);
    });

    it('passes the pre-parsed body through to the SDK', async () => {
      service.onModuleInit();
      const request = createRequest();
      const response = createResponse();
      const nodeHandler: jest.Mock = jest.fn().mockResolvedValue(undefined);
      internals(service).nodeHandler = nodeHandler;

      await service.handle(request, response);

      expect(nodeHandler).toHaveBeenCalledWith(request, response, request.body);
    });
  });

  describe('onApplicationShutdown', () => {
    it('resolves when the handler was never initialized', async () => {
      const fresh = build();

      await expect(fresh.onApplicationShutdown()).resolves.toBeUndefined();
    });
  });
});
