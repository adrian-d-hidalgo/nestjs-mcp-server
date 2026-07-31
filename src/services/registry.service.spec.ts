/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { CanActivate } from '@nestjs/common';
import { DiscoveryModule, ModuleRef, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import {
  MCP_GUARDS,
  MCP_PROMPT,
  MCP_RESOLVER,
  MCP_RESOURCE,
  MCP_TOOL,
} from '../decorators';
import type { McpContext } from '../interfaces/handler-context.interface';
import type {
  McpCapabilityGate,
  McpRegistrationContext,
} from '../interfaces/registration-context.interface';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';

// Definimos interfaces para los objetos de método mock
interface MockMethod {
  metadata: Record<string, unknown>;
  instance: Record<string, unknown>;
  handler: jest.Mock;
}

/**
 * A registration context for one request.
 *
 * Since 2.0 `registerAll` runs per HTTP request and this context is required —
 * it carries the request that every handler closure and every guard will see.
 */
function requestContext(
  headers: Record<string, string> = {},
): McpRegistrationContext {
  return {
    request: { headers, body: {} },
    era: 'modern',
  } as unknown as McpRegistrationContext;
}

/** The SDK `ServerContext` shape the transport passes as the last argument. */
function sdkContext(method = 'tools/call'): unknown {
  return { mcpReq: { id: 1, method } };
}

describe('RegistryService', () => {
  let service: RegistryService;

  describe('with Nest TestingModule', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [DiscoveryModule],
        providers: [
          RegistryService,
          DiscoveryService,
          McpLoggerService,
          Reflector,
        ],
      }).compile();

      service = module.get(RegistryService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should call registerResources, registerPrompts, registerTools in registerAll', async () => {
      const server = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      } as unknown as McpServer;

      const spyRes = jest
        .spyOn(service as any, 'registerResources')
        .mockResolvedValue(undefined);

      const spyPro = jest
        .spyOn(service as any, 'registerPrompts')
        .mockResolvedValue(undefined);

      const spyTool = jest
        .spyOn(service as any, 'registerTools')
        .mockResolvedValue(undefined);

      const context = requestContext();

      await service.registerAll(server, context);

      expect(spyRes).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyPro).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyTool).toHaveBeenCalledWith(server, context, expect.any(Array));
    });

    it('should forward the registration context to every register method', async () => {
      const server = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      } as unknown as McpServer;

      const context = {
        request: { headers: { 'x-role': 'admin' } },
      } as unknown as McpRegistrationContext;

      const spyRes = jest
        .spyOn(service as any, 'registerResources')
        .mockResolvedValue(undefined);

      const spyPro = jest
        .spyOn(service as any, 'registerPrompts')
        .mockResolvedValue(undefined);

      const spyTool = jest
        .spyOn(service as any, 'registerTools')
        .mockResolvedValue(undefined);

      await service.registerAll(server, context);

      expect(spyRes).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyPro).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyTool).toHaveBeenCalledWith(server, context, expect.any(Array));
    });

    it('should require a registration context and return a promise', async () => {
      const server = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      } as unknown as McpServer;

      jest
        .spyOn(service as any, 'registerResources')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'registerPrompts')
        .mockResolvedValue(undefined);
      jest.spyOn(service as any, 'registerTools').mockResolvedValue(undefined);

      // Two shape changes are pinned here, both MAJOR. `registerAll` returns a
      // promise that must be awaited — a consumer who ignores it holds an
      // incomplete registration — and the context is now required, because
      // under the stateless model there is always exactly one request being
      // served and every gate and guard is evaluated against it.
      const result: Promise<void> = service.registerAll(
        server,
        requestContext(),
      );

      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });
  });

  describe('unit tests for private logic', () => {
    let mockDiscovery: { getAllMethodsWithMetadata: jest.Mock };
    let mockLogger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
    let mockReflector: {
      get: jest.Mock;
      has: jest.Mock;
      hasMetadata: jest.Mock;
    };
    let mockServer: {
      registerResource: jest.Mock;
      registerPrompt: jest.Mock;
      registerTool: jest.Mock;
    };

    beforeEach(() => {
      mockDiscovery = {
        getAllMethodsWithMetadata: jest.fn(),
      };
      mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      mockReflector = {
        get: jest.fn(),
        has: jest.fn(),
        hasMetadata: jest.fn(),
      };
      mockServer = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      };
      const mockModuleRef = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Not found in DI');
        }),
        create: jest.fn().mockImplementation(() => {
          throw new Error('Cannot create');
        }),
      };
      service = new RegistryService(
        mockDiscovery as unknown as DiscoveryService,
        mockLogger as unknown as McpLoggerService,
        mockReflector as unknown as Reflector,
        mockModuleRef as unknown as ModuleRef,
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw if wrappedHandler is called on non-resolver', async () => {
      const handler = jest.fn();
      const instance = { constructor: () => {} };

      // Mock Reflect.hasMetadata (used inside RegistryService)
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(false);

      await expect(
        service['wrappedHandler'](
          instance,
          handler,
          [sdkContext()],
          requestContext(),
        ),
      ).rejects.toThrow(/must be decorated with @Resolver/);
    });

    /**
     * Before 2.0 this method demanded `extra.sessionId`, threw
     * `UnauthorizedException` without one and `ForbiddenException` when the
     * in-process `SessionManager` had no entry for it. Under the 2026-07-28
     * stateless model there is no session id on any request, so those two
     * branches would have rejected *every* call — they are gone, and these
     * tests replace them.
     */
    it('should invoke the handler with no session id present', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };

      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);
      jest.spyOn(service as any, 'runGuards').mockResolvedValue(undefined);

      const result = await service['wrappedHandler'](
        instance,
        handler,
        [sdkContext()],
        requestContext({ 'x-test': 'value' }),
      );

      expect(result).toBe('success');
    });

    it('should hand the handler this request’s own headers', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };

      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);
      const runGuardsSpy = jest
        .spyOn(service as any, 'runGuards')
        .mockResolvedValue(undefined);

      await service['wrappedHandler'](
        instance,
        handler,
        [sdkContext()],
        requestContext({ 'x-test': 'value' }),
      );

      // The context carries the live request, not a connect-time snapshot.
      // In 1.x these headers came from the `initialize` POST stored in the
      // session map and were frozen for the connection's life.
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'x-test': 'value' },
          request: expect.objectContaining({
            headers: { 'x-test': 'value' },
          }),
        }),
      );
      expect(runGuardsSpy).toHaveBeenCalled();
    });

    it('should preserve the SDK context fields it was given', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };

      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);
      jest.spyOn(service as any, 'runGuards').mockResolvedValue(undefined);

      await service['wrappedHandler'](
        instance,
        handler,
        [sdkContext('prompts/get')],
        requestContext(),
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpReq: expect.objectContaining({ method: 'prompts/get' }),
        }),
      );
    });

    it('runGuards should resolve if no guards', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const args: unknown[] = [];

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sdkContext() as McpContext,
          args,
        ),
      ).resolves.toBeUndefined();
    });

    it('runGuards should throw if guard denies access', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const args: unknown[] = [];
      const guard = { canActivate: jest.fn().mockResolvedValue(false) };

      // Mock Reflect.getMetadata to return the guard
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue([guard]);

      // Mock the private methods that are called inside runGuards
      jest.spyOn(service as any, 'getDecoratorType').mockReturnValue('TOOL');
      jest
        .spyOn(service as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sdkContext() as McpContext,
          args,
        ),
      ).rejects.toThrow(/Access denied by guard/);
    });

    describe('registerResources', () => {
      let mockResourceMethod: MockMethod;
      let mockInstance: Record<string, unknown>;
      let mockHandler: jest.Mock;

      beforeEach(() => {
        mockInstance = { constructor: { name: 'ResourceResolver' } };
        mockHandler = jest.fn().mockReturnValue('resource-result');
        // Create a wrapped handler spy
        jest
          .spyOn(service as any, 'wrappedHandler')
          .mockReturnValue(() => 'wrapped-result');
      });

      it('should register a URI resource without metadata', async () => {
        mockResourceMethod = {
          metadata: { name: 'test-uri-resource', uri: 'https://example.com' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockResourceMethod,
        ]);

        await service['registerResources'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('test-uri-resource'),
          'resources',
        );
        expect(mockServer.registerResource).toHaveBeenCalledWith(
          'test-uri-resource',
          'https://example.com',
          {},
          expect.any(Function),
        );
      });

      it('should register a URI resource with metadata', async () => {
        mockResourceMethod = {
          metadata: {
            name: 'test-uri-resource-with-meta',
            uri: 'https://example.com',
            metadata: { key: 'value' },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockResourceMethod,
        ]);

        await service['registerResources'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerResource).toHaveBeenCalledWith(
          'test-uri-resource-with-meta',
          'https://example.com',
          { key: 'value' },
          expect.any(Function),
        );
      });

      it('should register a template resource without metadata', async () => {
        mockResourceMethod = {
          metadata: {
            name: 'test-template-resource',
            template: 'template-content',
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockResourceMethod,
        ]);

        await service['registerResources'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerResource).toHaveBeenCalledWith(
          'test-template-resource',
          expect.any(ResourceTemplate),
          {},
          expect.any(Function),
        );
      });

      it('should register a template resource with metadata', async () => {
        mockResourceMethod = {
          metadata: {
            name: 'test-template-resource-with-meta',
            template: 'template-content',
            metadata: { key: 'value' },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockResourceMethod,
        ]);

        await service['registerResources'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerResource).toHaveBeenCalledWith(
          'test-template-resource-with-meta',
          expect.any(ResourceTemplate),
          { key: 'value' },
          expect.any(Function),
        );
      });

      it('should handle errors when registering resources', async () => {
        mockResourceMethod = {
          metadata: { name: 'error-resource', uri: 'https://example.com' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockResourceMethod,
        ]);

        // Make the resource registration throw an error
        const testError = new Error('Test error');
        testError.stack = 'Test stack trace';
        mockServer.registerResource.mockImplementation(() => {
          throw testError;
        });

        await service['registerResources'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error registering resource error-resource'),
          undefined,
          'resources',
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Test stack trace'),
          undefined,
          'resources',
        );
      });
    });

    describe('2026-07-28 config passthrough', () => {
      it('forwards title, outputSchema, icons and _meta to registerTool', async () => {
        const outputSchema = { '~standard': {} };
        const icons = [{ src: 'https://example.com/i.png' }];

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          {
            metadata: {
              name: 'rich_tool',
              title: 'Rich Tool',
              outputSchema,
              icons,
              _meta: { 'com.example/team': 'platform' },
            },
            instance: { constructor: { name: 'R' } },
            handler: jest.fn(),
          },
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'rich_tool',
          {
            title: 'Rich Tool',
            outputSchema,
            icons,
            _meta: { 'com.example/team': 'platform' },
          },
          expect.any(Function),
        );
      });

      it('omits absent optional fields rather than sending undefined', async () => {
        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          {
            metadata: { name: 'bare_tool' },
            instance: { constructor: { name: 'R' } },
            handler: jest.fn(),
          },
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        // An explicit `title: undefined` would override the SDK's own default
        // handling, so absent fields must not appear in the config at all.
        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'bare_tool',
          {},
          expect.any(Function),
        );
      });

      it('forwards title, icons and _meta to registerPrompt', async () => {
        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          {
            metadata: {
              name: 'rich_prompt',
              title: 'Rich Prompt',
              _meta: { 'com.example/k': 'v' },
            },
            instance: { constructor: { name: 'R' } },
            handler: jest.fn(),
          },
        ]);

        await service['registerPrompts'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          'rich_prompt',
          { title: 'Rich Prompt', _meta: { 'com.example/k': 'v' } },
          expect.any(Function),
        );
      });

      it('merges a resource cacheHint into the registration config', async () => {
        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          {
            metadata: {
              name: 'cached',
              uri: 'res://cached',
              metadata: { mimeType: 'application/json' },
              cacheHint: { ttlMs: 1000, cacheScope: 'public' },
            },
            instance: { constructor: { name: 'R' } },
            handler: jest.fn(),
          },
        ]);

        await service['registerResources'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerResource).toHaveBeenCalledWith(
          'cached',
          'res://cached',
          {
            mimeType: 'application/json',
            cacheHint: { ttlMs: 1000, cacheScope: 'public' },
          },
          expect.any(Function),
        );
      });
    });

    describe('registerPrompts', () => {
      let mockPromptMethod: MockMethod;
      let mockInstance: Record<string, unknown>;
      let mockHandler: jest.Mock;

      beforeEach(() => {
        mockInstance = { constructor: { name: 'PromptResolver' } };
        mockHandler = jest.fn().mockReturnValue('prompt-result');
        // Create a wrapped handler spy
        jest
          .spyOn(service as any, 'wrappedHandler')
          .mockReturnValue(() => 'wrapped-result');
      });

      it('should register a basic prompt', async () => {
        mockPromptMethod = {
          metadata: { name: 'test-prompt' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockPromptMethod,
        ]);

        await service['registerPrompts'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('test-prompt'),
          'prompts',
        );
        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          'test-prompt',
          {},
          expect.any(Function),
        );
      });

      it('should register a prompt with description', async () => {
        mockPromptMethod = {
          metadata: {
            name: 'test-prompt-with-description',
            description: 'A test prompt',
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockPromptMethod,
        ]);

        await service['registerPrompts'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          'test-prompt-with-description',
          { description: 'A test prompt' },
          expect.any(Function),
        );
      });

      it('should register a prompt with argsSchema', async () => {
        mockPromptMethod = {
          metadata: {
            name: 'test-prompt-with-args',
            argsSchema: { arg1: 'schema' },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockPromptMethod,
        ]);

        await service['registerPrompts'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          'test-prompt-with-args',
          { argsSchema: { arg1: 'schema' } },
          expect.any(Function),
        );
      });

      it('should register a prompt with description and argsSchema', async () => {
        mockPromptMethod = {
          metadata: {
            name: 'test-prompt-with-description-and-args',
            description: 'A test prompt',
            argsSchema: { arg1: 'schema' },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockPromptMethod,
        ]);

        await service['registerPrompts'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerPrompt).toHaveBeenCalledWith(
          'test-prompt-with-description-and-args',
          { description: 'A test prompt', argsSchema: { arg1: 'schema' } },
          expect.any(Function),
        );
      });

      it('should handle errors when registering prompts', async () => {
        mockPromptMethod = {
          metadata: { name: 'error-prompt' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockPromptMethod,
        ]);

        // Make the prompt registration throw an error
        const testError = new Error('Test error');
        testError.stack = 'Test stack trace';
        mockServer.registerPrompt.mockImplementation(() => {
          throw testError;
        });

        await service['registerPrompts'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error registering prompt error-prompt'),
          undefined,
          'prompts',
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Test stack trace'),
          undefined,
          'prompts',
        );
      });
    });

    describe('registerTools', () => {
      let mockToolMethod: MockMethod;
      let mockInstance: Record<string, unknown>;
      let mockHandler: jest.Mock;

      beforeEach(() => {
        mockInstance = { constructor: { name: 'ToolResolver' } };
        mockHandler = jest.fn().mockReturnValue('tool-result');
        // Create a wrapped handler spy
        jest
          .spyOn(service as any, 'wrappedHandler')
          .mockReturnValue(() => 'wrapped-result');
      });

      it('should register a basic tool', async () => {
        mockToolMethod = {
          metadata: { name: 'test-tool' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('test-tool'),
          'tools',
        );
        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool',
          {},
          expect.any(Function),
        );
      });

      it('should register a tool with description', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-description',
            description: 'A test tool',
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-description',
          { description: 'A test tool' },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-params',
            paramsSchema: { param1: 'schema' },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-params',
          { inputSchema: { param1: 'schema' } },
          expect.any(Function),
        );
      });

      it('should register a tool with annotations', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-annotations',
            annotations: { destructiveHint: true },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-annotations',
          { annotations: { destructiveHint: true } },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema and description', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-params-and-description',
            description: 'A test tool',
            paramsSchema: { param1: 'schema' },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-params-and-description',
          { description: 'A test tool', inputSchema: { param1: 'schema' } },
          expect.any(Function),
        );
      });

      it('should register a tool with annotations and description', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-annotations-and-description',
            description: 'A test tool',
            annotations: { destructiveHint: true },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-annotations-and-description',
          {
            description: 'A test tool',
            annotations: { destructiveHint: true },
          },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema and annotations', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-params-and-annotations',
            paramsSchema: { param1: 'schema' },
            annotations: { destructiveHint: true },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-params-and-annotations',
          {
            inputSchema: { param1: 'schema' },
            annotations: { destructiveHint: true },
          },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema, annotations, and description', async () => {
        mockToolMethod = {
          metadata: {
            name: 'test-tool-with-params-annotations-description',
            description: 'A test tool',
            paramsSchema: { param1: 'schema' },
            annotations: { destructiveHint: true },
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'test-tool-with-params-annotations-description',
          {
            description: 'A test tool',
            inputSchema: { param1: 'schema' },
            annotations: { destructiveHint: true },
          },
          expect.any(Function),
        );
      });

      it('should handle errors when registering tools', async () => {
        mockToolMethod = {
          metadata: { name: 'error-tool' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        // Make the tool registration throw an error
        const testError = new Error('Test error');
        testError.stack = 'Test stack trace';
        mockServer.registerTool.mockImplementation(() => {
          throw testError;
        });

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error registering tool error-tool'),
          undefined,
          'tools',
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Test stack trace'),
          undefined,
          'tools',
        );
      });
    });

    describe('registerTools with Zod schemas', () => {
      let mockToolMethod: MockMethod;
      let mockInstance: Record<string, unknown>;
      let mockHandler: jest.Mock;

      beforeEach(() => {
        mockInstance = { constructor: { name: 'ToolResolver' } };
        mockHandler = jest.fn().mockReturnValue('tool-result');
        jest
          .spyOn(service as any, 'wrappedHandler')
          .mockReturnValue(() => 'wrapped-result');
      });

      it('should register a tool with string paramsSchema', async () => {
        const { z } = await import('zod');

        const schema = { name: z.string() };

        mockToolMethod = {
          metadata: {
            name: 'string-tool',
            description: 'Tool with string schema',
            paramsSchema: schema,
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'string-tool',
          { description: 'Tool with string schema', inputSchema: schema },
          expect.any(Function),
        );
      });

      it('should register a tool with complex paramsSchema', async () => {
        const { z } = await import('zod');

        const schema = {
          name: z.string(),
          age: z.number().optional(),
          tags: z.array(z.string()),
        };

        mockToolMethod = {
          metadata: {
            name: 'complex-tool',
            description: 'Tool with complex schema',
            paramsSchema: schema,
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'complex-tool',
          { description: 'Tool with complex schema', inputSchema: schema },
          expect.any(Function),
        );
      });

      it('should register a tool with enum paramsSchema', async () => {
        const { z } = await import('zod');

        const schema = {
          status: z.enum(['active', 'inactive', 'pending']),
        };

        mockToolMethod = {
          metadata: {
            name: 'enum-tool',
            description: 'Tool with enum schema',
            paramsSchema: schema,
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'enum-tool',
          { description: 'Tool with enum schema', inputSchema: schema },
          expect.any(Function),
        );
      });

      it('should register a tool with nested object paramsSchema', async () => {
        const { z } = await import('zod');

        const schema = {
          user: z.object({
            name: z.string(),
            email: z.string().email(),
            profile: z.object({
              bio: z.string().optional(),
              avatar: z.string().url().optional(),
            }),
          }),
        };

        mockToolMethod = {
          metadata: {
            name: 'nested-tool',
            description: 'Tool with nested schema',
            paramsSchema: schema,
          },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        await service['registerTools'](
          mockServer as unknown as McpServer,
          requestContext(),
          [],
        );

        expect(mockServer.registerTool).toHaveBeenCalledWith(
          'nested-tool',
          { description: 'Tool with nested schema', inputSchema: schema },
          expect.any(Function),
        );
      });
    });
  });

  describe('guard dependency injection', () => {
    /**
     * A stand-in for the injected collaborator a real guard would use. Before
     * 2.0 these tests injected `SessionManager`, which no longer exists; the
     * regression they protect is unrelated to it and still matters — see
     * below.
     */
    class TokenStore {
      isRevoked(_token: string): boolean {
        return false;
      }
    }

    const buildRegistry = (mockModuleRef: {
      get: jest.Mock;
      create: jest.Mock;
    }) =>
      new RegistryService(
        { getAllMethodsWithMetadata: jest.fn() } as unknown as DiscoveryService,
        {
          log: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        } as unknown as McpLoggerService,
        new Reflector(),
        mockModuleRef as unknown as ModuleRef,
      );

    /**
     * This test verifies that guards can receive dependencies via NestJS DI.
     * Issue #70: dependency injection into guards was not working because
     * guards were instantiated with `new Guard()` instead of using ModuleRef.
     */
    it('should use ModuleRef.get to resolve guards from DI container', async () => {
      // Simple guard that always returns true
      class TestGuard implements CanActivate {
        canActivate(_context: any): boolean {
          return true;
        }
      }

      // Pre-instantiated guard (simulating what DI would return)
      const resolvedGuardInstance = new TestGuard();

      // Mock ModuleRef to return our pre-instantiated guard
      const mockModuleRef = {
        get: jest.fn().mockReturnValue(resolvedGuardInstance),
        create: jest.fn(),
      };

      const registryService = buildRegistry(mockModuleRef);

      // Create resolver with guard attached
      class TestResolver {
        testMethod(): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();

      // Set up metadata
      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [TestGuard], TestResolver);

      // Mock getHandlerArgs to avoid Reflector dependency
      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      // Run guards
      await registryService['runGuards'](
        resolverInstance,
        'testMethod',
        sdkContext() as McpContext,
        [sdkContext()],
      );

      // Verify ModuleRef.get was called with the guard class
      expect(mockModuleRef.get).toHaveBeenCalledWith(TestGuard, {
        strict: false,
      });
    });

    it('should inject collaborators into guards when registered as providers', async () => {
      // Guard that verifies its dependency was injected
      class TokenGuard implements CanActivate {
        public dependencyInjected = false;

        constructor(private tokens: TokenStore) {
          this.dependencyInjected = tokens !== undefined;
        }

        canActivate(_context: any): boolean {
          if (!this.tokens) {
            throw new Error('TokenStore was not injected!');
          }
          // Just verify injection worked, always allow
          return true;
        }
      }

      // Pre-instantiated guard WITH its dependency injected
      const injectedGuard = new TokenGuard(new TokenStore());
      expect(injectedGuard.dependencyInjected).toBe(true);

      // ModuleRef returns the pre-injected guard
      const mockModuleRef = {
        get: jest.fn().mockReturnValue(injectedGuard),
        create: jest.fn(),
      };

      const registryService = buildRegistry(mockModuleRef);

      class TestResolver {
        testMethod(): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();
      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [TokenGuard], TestResolver);

      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      // Should NOT throw - the guard should have its dependency injected
      await expect(
        registryService['runGuards'](
          resolverInstance,
          'testMethod',
          sdkContext() as McpContext,
          [sdkContext()],
        ),
      ).resolves.toBeUndefined();

      expect(mockModuleRef.get).toHaveBeenCalled();
    });

    it('should instantiate guards directly when not registered in DI container', async () => {
      class SimpleGuard implements CanActivate {
        canActivate(_context: any): boolean {
          return true;
        }
      }

      const mockModuleRef = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Not found in DI');
        }),
        create: jest.fn().mockImplementation(() => {
          throw new Error('Cannot create');
        }),
      };
      const registryService = buildRegistry(mockModuleRef);

      class TestResolver {
        testMethod(this: void): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();
      const testMethodRef = TestResolver.prototype.testMethod;

      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [SimpleGuard], TestResolver);
      Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, testMethodRef);

      // Mock getHandlerArgs to return valid handler args
      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      // Should work via fallback to direct instantiation
      await expect(
        registryService['runGuards'](
          resolverInstance,
          'testMethod',
          sdkContext() as McpContext,
          [sdkContext()],
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('getDecoratorType and getHandlerArgs', () => {
    let mockDiscovery: { getAllMethodsWithMetadata: jest.Mock };
    let mockLogger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
    let mockReflector: Reflector;
    let mockModuleRef: { get: jest.Mock; create: jest.Mock };
    let registryService: RegistryService;

    beforeEach(() => {
      mockDiscovery = { getAllMethodsWithMetadata: jest.fn() };
      mockLogger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };
      mockReflector = new Reflector();
      mockModuleRef = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Not found');
        }),
        create: jest.fn().mockImplementation(() => {
          throw new Error('Cannot create');
        }),
      };

      registryService = new RegistryService(
        mockDiscovery as unknown as DiscoveryService,
        mockLogger as unknown as McpLoggerService,
        mockReflector,
        mockModuleRef as unknown as ModuleRef,
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('getDecoratorType', () => {
      it('should return null for undefined method', () => {
        const result = registryService['getDecoratorType'](undefined);
        expect(result).toBeNull();
      });

      it('should return TOOL for method with MCP_TOOL metadata', () => {
        const mockMethod = function testTool() {};
        Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, mockMethod);

        const result = registryService['getDecoratorType'](mockMethod as any);
        expect(result).toBe('TOOL');
      });

      it('should return null for method without MCP metadata', () => {
        const mockMethod = function noMetadata() {};

        const result = registryService['getDecoratorType'](mockMethod as any);
        expect(result).toBeNull();
      });
    });

    describe('getHandlerArgs', () => {
      it('should throw error when method is undefined', () => {
        expect(() => {
          registryService['getHandlerArgs'](undefined, []);
        }).toThrow('Method not found');
      });

      it('should throw error for unknown decorator type', () => {
        const mockMethod = function unknownMethod() {};

        expect(() => {
          registryService['getHandlerArgs'](mockMethod as any, []);
        }).toThrow('Unknown decorator type');
      });

      it('should return ToolHandlerArgs for TOOL with params', () => {
        const mockMethod = function testTool() {};
        Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, mockMethod);

        const params = { id: '123' };
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          params,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return ToolHandlerArgs for TOOL without params', () => {
        const mockMethod = function testTool() {};
        Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, mockMethod);

        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return PromptHandlerArgs for PROMPT with args', () => {
        const mockMethod = function testPrompt() {};
        Reflect.defineMetadata(MCP_PROMPT, { name: 'test_prompt' }, mockMethod);

        const promptArgs = { topic: 'test' };
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          promptArgs,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return PromptHandlerArgs for PROMPT without args', () => {
        const mockMethod = function testPrompt() {};
        Reflect.defineMetadata(MCP_PROMPT, { name: 'test_prompt' }, mockMethod);

        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return ResourceUriHandlerArgs for RESOURCE with URL', () => {
        const mockMethod = function testResource() {};
        Reflect.defineMetadata(
          MCP_RESOURCE,
          { name: 'test_resource' },
          mockMethod,
        );

        const url = new URL('https://example.com/resource');
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          url,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return ResourceTemplateHandlerArgs for RESOURCE with template params', () => {
        const mockMethod = function testResource() {};
        Reflect.defineMetadata(
          MCP_RESOURCE,
          { name: 'test_resource' },
          mockMethod,
        );

        const uri = 'template-uri';
        const templateParams = { id: '123' };
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          uri,
          templateParams,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });
    });

    describe('resolveGuard', () => {
      it('should return guard instance if already instantiated', async () => {
        const guardInstance = { canActivate: jest.fn().mockReturnValue(true) };

        const result = await registryService['resolveGuard'](guardInstance);

        expect(result).toBe(guardInstance);
      });

      it('should use ModuleRef.create when ModuleRef.get fails', async () => {
        class TestGuard implements CanActivate {
          canActivate(): boolean {
            return true;
          }
        }

        const createdGuard = new TestGuard();
        mockModuleRef.create.mockResolvedValue(createdGuard);

        const result = await registryService['resolveGuard'](TestGuard);

        expect(mockModuleRef.get).toHaveBeenCalledWith(TestGuard, {
          strict: false,
        });
        expect(mockModuleRef.create).toHaveBeenCalledWith(TestGuard);
        expect(result).toBe(createdGuard);
      });
    });
  });

  /**
   * Capability gates: the `enabled` option resolved as a class through the Nest
   * container, awaited once per connection.
   *
   * Every case goes through the public `registerAll`, because that is where the
   * gate wave lives — the three register methods deliberately return before any
   * gate has settled.
   */
  describe('capability gates', () => {
    interface Handle {
      enabled: boolean;
      enable: jest.Mock;
      disable: jest.Mock;
      update: jest.Mock;
      remove: jest.Mock;
    }

    const createHandle = (): Handle => ({
      enabled: true,
      enable: jest.fn(),
      disable: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    });

    const discovered = (metadata: Record<string, unknown>): MockMethod => ({
      metadata,
      instance: { constructor: { name: 'DynamicResolver' } },
      handler: jest.fn(),
    });

    const context = {
      request: { headers: { 'x-role': 'admin' } },
    } as unknown as McpRegistrationContext;

    interface Harness {
      service: RegistryService;
      server: McpServer;
      /** The SDK registration mocks, exposed so a test can set the handle. */
      tool: jest.Mock;
      prompt: jest.Mock;
      resource: jest.Mock;
      logger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
      moduleRef: { get: jest.Mock; create: jest.Mock };
    }

    const buildHarness = (
      methods: {
        tools?: MockMethod[];
        prompts?: MockMethod[];
        resources?: MockMethod[];
      },
      provided: [unknown, unknown][] = [],
    ): Harness => {
      const container = new Map<unknown, unknown>(provided);

      const discovery = {
        getAllMethodsWithMetadata: jest.fn((key: string) => {
          if (key === MCP_TOOL) return methods.tools ?? [];
          if (key === MCP_PROMPT) return methods.prompts ?? [];
          if (key === MCP_RESOURCE) return methods.resources ?? [];
          return [];
        }),
      };

      const logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };

      const moduleRef = {
        get: jest.fn((token: unknown) => {
          if (container.has(token)) return container.get(token);
          throw new Error('Nest could not find the provider');
        }),
        create: jest.fn(() => {
          throw new Error('Nest could not create the instance');
        }),
      };

      const service = new RegistryService(
        discovery as unknown as DiscoveryService,
        logger as unknown as McpLoggerService,
        new Reflector(),
        moduleRef as unknown as ModuleRef,
      );

      jest
        .spyOn(service as any, 'wrappedHandler')
        .mockReturnValue(() => 'wrapped-result');

      const tool = jest.fn();
      const prompt = jest.fn();
      const resource = jest.fn();
      const server = {
        registerResource: resource,
        registerPrompt: prompt,
        registerTool: tool,
      };

      return {
        service,
        server: server as unknown as McpServer,
        tool,
        prompt,
        resource,
        logger,
        moduleRef,
      };
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('resolves a gate class through ModuleRef and keeps the capability when it answers true', async () => {
      class AllowGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return Promise.resolve(true);
        }
      }

      const handle = createHandle();
      const gate = new AllowGate();
      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: AllowGate })] },
        [[AllowGate, gate]],
      );
      harness.tool.mockReturnValue(handle);

      await harness.service.registerAll(harness.server, context);

      expect(harness.moduleRef.get).toHaveBeenCalledWith(AllowGate, {
        strict: false,
      });
      expect(handle.disable).not.toHaveBeenCalled();
    });

    it('disables a capability whose gate resolves false after a real tick', async () => {
      class DeniedGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          // A deferred promise, not Promise.resolve: a pending promise is
          // truthy, so an implementation that skips the await passes with
          // Promise.resolve and fails here.
          return new Promise((resolve) => setTimeout(() => resolve(false), 5));
        }
      }

      const handle = createHandle();
      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: DeniedGate })] },
        [[DeniedGate, new DeniedGate()]],
      );
      harness.tool.mockReturnValue(handle);

      await harness.service.registerAll(harness.server, context);

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('passes the connection context to the gate', async () => {
      const isEnabled = jest.fn().mockResolvedValue(true);
      class ContextGate implements McpCapabilityGate {
        isEnabled(ctx: McpRegistrationContext): Promise<boolean> {
          return isEnabled(ctx) as Promise<boolean>;
        }
      }

      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: ContextGate })] },
        [[ContextGate, new ContextGate()]],
      );
      harness.tool.mockReturnValue(createHandle());

      await harness.service.registerAll(harness.server, context);

      expect(isEnabled).toHaveBeenCalledTimes(1);
      expect(isEnabled).toHaveBeenCalledWith(context);
    });

    it('has applied every gate verdict by the time registerAll resolves', async () => {
      // The async-ordering backstop. A missed `await` inside registerAll is only
      // an eslint warning, so nothing but this catches it.
      let release!: (value: boolean) => void;
      const deferred = new Promise<boolean>((resolve) => {
        release = resolve;
      });

      class DeferredGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return deferred;
        }
      }

      const handle = createHandle();
      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: DeferredGate })] },
        [[DeferredGate, new DeferredGate()]],
      );
      harness.tool.mockReturnValue(handle);

      const registration = harness.service.registerAll(harness.server, context);

      expect(handle.disable).not.toHaveBeenCalled();

      release(false);
      await registration;

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('asks each distinct gate class exactly once per request', async () => {
      const isEnabled = jest.fn().mockResolvedValue(true);
      class SharedGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return isEnabled() as Promise<boolean>;
        }
      }

      const harness = buildHarness(
        {
          tools: [
            discovered({ name: 'tool_a', enabled: SharedGate }),
            discovered({ name: 'tool_b', enabled: SharedGate }),
            discovered({ name: 'tool_c', enabled: SharedGate }),
          ],
        },
        [[SharedGate, new SharedGate()]],
      );
      harness.tool.mockReturnValue(createHandle());

      await harness.service.registerAll(harness.server, context);

      // Before 2.0 this was one container resolution but N `isEnabled` calls,
      // which was affordable when gates ran once per connection. They now run
      // once per HTTP request, so the verdict is memoised per gate class for
      // the life of the call: three tools sharing a gate ask it once between
      // them. Safe because the registration context is a single object for
      // the whole call — and deliberately never cached beyond it, since a
      // verdict reused across requests would defeat the point.
      expect(harness.moduleRef.get).toHaveBeenCalledTimes(1);
      expect(isEnabled).toHaveBeenCalledTimes(1);
    });

    it('evaluates gates in one concurrent wave, not N serial round-trips', async () => {
      // Every gate must be in flight before any of them settles. A serial
      // implementation never reaches the third arrival and fails by timeout.
      const total = 3;
      let arrived = 0;
      let open!: () => void;
      const allArrived = new Promise<void>((resolve) => {
        open = resolve;
      });

      class BarrierGate implements McpCapabilityGate {
        async isEnabled(): Promise<boolean> {
          arrived += 1;
          if (arrived === total) open();
          await allArrived;
          return true;
        }
      }

      // Three *distinct* classes, not three capabilities sharing one: the
      // per-request verdict memo would collapse a shared gate to a single
      // call, and this test is about the wave being concurrent across gates.
      class BarrierGateA extends BarrierGate {}
      class BarrierGateB extends BarrierGate {}
      class BarrierGateC extends BarrierGate {}

      const harness = buildHarness(
        {
          tools: [
            discovered({ name: 'tool_a', enabled: BarrierGateA }),
            discovered({ name: 'tool_b', enabled: BarrierGateB }),
            discovered({ name: 'tool_c', enabled: BarrierGateC }),
          ],
        },
        [
          [BarrierGateA, new BarrierGateA()],
          [BarrierGateB, new BarrierGateB()],
          [BarrierGateC, new BarrierGateC()],
        ],
      );
      harness.tool.mockReturnValue(createHandle());

      await harness.service.registerAll(harness.server, context);

      expect(arrived).toBe(total);
    });

    it('falls back to ModuleRef.create when the gate is not a provider', async () => {
      class CreatableGate implements McpCapabilityGate {
        isEnabled(): boolean {
          return true;
        }
      }

      const handle = createHandle();
      const harness = buildHarness({
        tools: [discovered({ name: 'gated_tool', enabled: CreatableGate })],
      });
      harness.moduleRef.create.mockResolvedValue(new CreatableGate());
      harness.tool.mockReturnValue(handle);

      await harness.service.registerAll(harness.server, context);

      expect(harness.moduleRef.create).toHaveBeenCalledWith(CreatableGate);
      expect(handle.disable).not.toHaveBeenCalled();
    });

    describe('fail-closed', () => {
      it('case 1: a gate that throws synchronously disables it, siblings untouched', async () => {
        class ThrowingGate implements McpCapabilityGate {
          isEnabled(): boolean {
            throw new Error('entitlements service unreachable');
          }
        }

        const gatedHandle = createHandle();
        const siblingHandle = createHandle();
        const harness = buildHarness(
          {
            tools: [
              discovered({ name: 'throwing_tool', enabled: ThrowingGate }),
              discovered({ name: 'sibling_tool' }),
            ],
          },
          [[ThrowingGate, new ThrowingGate()]],
        );
        harness.tool
          .mockReturnValueOnce(gatedHandle)
          .mockReturnValueOnce(siblingHandle);

        await harness.service.registerAll(harness.server, context);

        expect(gatedHandle.disable).toHaveBeenCalledTimes(1);
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('throwing_tool'),
          undefined,
          'tools',
        );
        expect(siblingHandle.disable).not.toHaveBeenCalled();
      });

      it('case 2: a gate whose promise rejects disables it, siblings untouched', async () => {
        class RejectingGate implements McpCapabilityGate {
          isEnabled(): Promise<boolean> {
            return Promise.reject(new Error('lookup timed out'));
          }
        }

        const gatedHandle = createHandle();
        const siblingHandle = createHandle();
        const harness = buildHarness(
          {
            tools: [
              discovered({ name: 'rejecting_tool', enabled: RejectingGate }),
              discovered({ name: 'sibling_tool' }),
            ],
          },
          [[RejectingGate, new RejectingGate()]],
        );
        harness.tool
          .mockReturnValueOnce(gatedHandle)
          .mockReturnValueOnce(siblingHandle);

        // A try/catch around the call — instead of around the await — catches
        // case 1 and misses this entirely, and an unhandled rejection would
        // abort the whole Promise.all wave.
        await expect(
          harness.service.registerAll(harness.server, context),
        ).resolves.toBeUndefined();

        expect(gatedHandle.disable).toHaveBeenCalledTimes(1);
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('rejecting_tool'),
          undefined,
          'tools',
        );
        expect(siblingHandle.disable).not.toHaveBeenCalled();
      });

      it('case 3: an unresolvable gate class disables it and is never instantiated with new', async () => {
        const constructed = jest.fn();

        class UnresolvableGate implements McpCapabilityGate {
          constructor() {
            constructed();
          }

          isEnabled(): boolean {
            return true;
          }
        }

        const handle = createHandle();
        const harness = buildHarness({
          tools: [
            discovered({ name: 'orphan_tool', enabled: UnresolvableGate }),
          ],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).toHaveBeenCalledTimes(1);
        // `resolveGuard` falls back to `new Guard()`; a gate must not — a
        // `new`-built gate has undefined dependencies and can answer truthy.
        expect(constructed).not.toHaveBeenCalled();
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('orphan_tool'),
          undefined,
          'tools',
        );
      });

      // The former "case 4" covered a gate declared when `registerAll` was
      // called without a registration context. That branch is gone in 2.0:
      // the context is a required parameter, because the stateless model
      // always has exactly one request in hand when the server is built. The
      // scenario is now a compile error rather than a runtime fail-closed.

      it('case 5: a failing disable() leaves the capability enabled and says so', async () => {
        const handle = createHandle();
        handle.disable.mockImplementation(() => {
          throw new Error('sdk exploded');
        });

        const harness = buildHarness({
          tools: [discovered({ name: 'off_tool', enabled: false })],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to disable tool "off_tool"'),
          undefined,
          'tools',
        );
        expect(harness.logger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('Error registering tool'),
          undefined,
          'tools',
        );
      });

      it('treats a non-boolean answer as disabled', async () => {
        class SloppyGate implements McpCapabilityGate {
          isEnabled(): boolean {
            return 'yes' as unknown as boolean;
          }
        }

        const handle = createHandle();
        const harness = buildHarness(
          { tools: [discovered({ name: 'sloppy_tool', enabled: SloppyGate })] },
          [[SloppyGate, new SloppyGate()]],
        );
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).toHaveBeenCalledTimes(1);
      });
    });

    describe('static toggles and the gate-free path', () => {
      it('disables a static false without consulting the container', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [discovered({ name: 'off_tool', enabled: false })],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        // Register-then-disable, never skip-registration: the SDK must answer
        // "Tool off_tool disabled", not "Tool off_tool not found".
        expect(harness.tool).toHaveBeenCalledWith(
          'off_tool',
          {},
          expect.any(Function),
        );
        expect(handle.disable).toHaveBeenCalledTimes(1);
        expect(harness.moduleRef.get).not.toHaveBeenCalled();
        expect(harness.moduleRef.create).not.toHaveBeenCalled();
      });

      it('leaves a static true alone', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [discovered({ name: 'on_tool', enabled: true })],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).not.toHaveBeenCalled();
        expect(harness.moduleRef.get).not.toHaveBeenCalled();
      });

      it('performs zero container lookups when no capability declares a gate', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [discovered({ name: 'plain_tool' })],
          prompts: [discovered({ name: 'plain_prompt', description: 'd' })],
          resources: [
            discovered({ name: 'plain_resource', uri: 'https://example.com' }),
          ],
        });
        harness.tool.mockReturnValue(handle);
        harness.prompt.mockReturnValue(handle);
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).not.toHaveBeenCalled();
        expect(harness.moduleRef.get).not.toHaveBeenCalled();
        expect(harness.moduleRef.create).not.toHaveBeenCalled();
      });
    });

    describe('prompts and resources honour a gate', () => {
      class DenyGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return Promise.resolve(false);
        }
      }

      it('disables a prompt whose gate answers false', async () => {
        const handle = createHandle();
        const harness = buildHarness(
          {
            prompts: [
              discovered({
                name: 'off_prompt',
                description: 'd',
                enabled: DenyGate,
              }),
            ],
          },
          [[DenyGate, new DenyGate()]],
        );
        harness.prompt.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.prompt).toHaveBeenCalled();
        expect(handle.disable).toHaveBeenCalledTimes(1);
      });

      it('disables a resource whose gate answers false', async () => {
        const handle = createHandle();
        const harness = buildHarness(
          {
            resources: [
              discovered({
                name: 'off_resource',
                uri: 'https://example.com',
                enabled: DenyGate,
              }),
            ],
          },
          [[DenyGate, new DenyGate()]],
        );
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.resource).toHaveBeenCalled();
        expect(handle.disable).toHaveBeenCalledTimes(1);
      });
    });

    /**
     * Every registration branch must bind the handle it returns. A branch that
     * drops the assignment leaves that permutation silently un-gateable while
     * still type-checking at the call site — the `let handle` declaration
     * without `| undefined` is the compiler's half of this guarantee, and these
     * cases are the runtime half.
     */
    describe('handle binding across every registration branch', () => {
      it.each([
        ['ToolBaseOptions', {}],
        ['ToolWithDescriptionOptions', { description: 'd' }],
        ['ToolWithParamsSchemaOptions', { paramsSchema: { a: 'schema' } }],
        [
          'ToolWithParamsSchemaAndDescriptionOptions',
          { description: 'd', paramsSchema: { a: 'schema' } },
        ],
        ['ToolWithAnnotationsOptions', { annotations: { readOnlyHint: true } }],
        [
          'ToolWithAnnotationsAndDescriptionOptions',
          { description: 'd', annotations: { readOnlyHint: true } },
        ],
        [
          'ToolWithParamsSchemaAndAnnotationsOptions',
          {
            paramsSchema: { a: 'schema' },
            annotations: { readOnlyHint: true },
          },
        ],
        [
          'ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions',
          {
            description: 'd',
            paramsSchema: { a: 'schema' },
            annotations: { readOnlyHint: true },
          },
        ],
      ])('binds the handle for %s', async (_name, extra) => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [
            discovered({ name: 'permutation_tool', enabled: false, ...extra }),
          ],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).toHaveBeenCalledTimes(1);
      });

      it.each([
        [
          'a URI resource without metadata',
          { uri: 'https://example.com' },
          ['off_resource', 'https://example.com', {}],
        ],
        [
          'a URI resource with metadata',
          { uri: 'https://example.com', metadata: { version: '1.0' } },
          ['off_resource', 'https://example.com', { version: '1.0' }],
        ],
        [
          'a template resource without metadata',
          { template: 'resource://test/{id}' },
          ['off_resource', expect.any(ResourceTemplate), {}],
        ],
        [
          'a template resource with metadata',
          { template: 'resource://test/{id}', metadata: { version: '1.0' } },
          ['off_resource', expect.any(ResourceTemplate), { version: '1.0' }],
        ],
      ])('binds the handle for %s', async (_name, extra, expectedArgs) => {
        const handle = createHandle();
        const harness = buildHarness({
          resources: [
            discovered({ name: 'off_resource', enabled: false, ...extra }),
          ],
        });
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.resource).toHaveBeenCalledWith(
          ...expectedArgs,
          expect.any(Function),
        );
        expect(handle.disable).toHaveBeenCalledTimes(1);
      });

      it('claims nothing was disabled when resource metadata matches no branch', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          resources: [
            discovered({ name: 'malformed_resource', enabled: false }),
          ],
        });
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        // Nothing was registered, so nothing can be disabled — and the loop
        // must not claim otherwise.
        expect(harness.resource).not.toHaveBeenCalled();
        expect(handle.disable).not.toHaveBeenCalled();
        expect(harness.logger.log).not.toHaveBeenCalledWith(
          expect.stringContaining('disabled for this connection'),
          'resources',
        );
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Error registering resource malformed_resource',
          ),
          undefined,
          'resources',
        );
      });
    });
  });
});
