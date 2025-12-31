/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CanActivate,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DiscoveryModule, ModuleRef, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';

import {
  MCP_GUARDS,
  MCP_PROMPT,
  MCP_RESOLVER,
  MCP_RESOURCE,
  MCP_TOOL,
} from '../decorators';
import { McpExecutionContext } from '../interfaces/context.interface';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';
import { SessionManager } from './session.manager';

// Definimos interfaces para los objetos de método mock
interface MockMethod {
  metadata: Record<string, unknown>;
  instance: Record<string, unknown>;
  handler: jest.Mock;
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
          SessionManager,
          Reflector,
        ],
      }).compile();

      service = module.get(RegistryService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should call registerResources, registerPrompts, registerTools in registerAll', () => {
      const server = {
        resource: jest.fn(),
        prompt: jest.fn(),
        tool: jest.fn(),
      } as unknown as McpServer;

      const spyRes = jest
        .spyOn(service as any, 'registerResources')
        .mockImplementation(() => {});

      const spyPro = jest
        .spyOn(service as any, 'registerPrompts')
        .mockImplementation(() => {});

      const spyTool = jest
        .spyOn(service as any, 'registerTools')
        .mockImplementation(() => {});

      service.registerAll(server);

      expect(spyRes).toHaveBeenCalledWith(server);
      expect(spyPro).toHaveBeenCalledWith(server);
      expect(spyTool).toHaveBeenCalledWith(server);
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
    let mockSession: {
      getSession: jest.Mock;
      setSession: jest.Mock;
      deleteSession: jest.Mock;
    };
    let mockServer: { resource: jest.Mock; prompt: jest.Mock; tool: jest.Mock };

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
      mockSession = {
        getSession: jest.fn(),
        setSession: jest.fn(),
        deleteSession: jest.fn(),
      };
      mockServer = {
        resource: jest.fn(),
        prompt: jest.fn(),
        tool: jest.fn(),
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
        mockSession as unknown as SessionManager,
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
        service['wrappedHandler'](instance, handler, [{}]),
      ).rejects.toThrow(/must be decorated with @Resolver/);
    });

    it('should throw UnauthorizedException if sessionId is missing', async () => {
      const handler = jest.fn();
      const instance = { constructor: { name: 'TestResolver' } };

      // Mock Reflect.hasMetadata to return true for MCP_RESOLVER
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

      await expect(
        service['wrappedHandler'](instance, handler, [{}]),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if session not found', async () => {
      const handler = jest.fn();
      const instance = { constructor: { name: 'TestResolver' } };

      // Mock Reflect.hasMetadata to return true for MCP_RESOLVER
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

      mockSession.getSession.mockReturnValue(undefined);

      await expect(
        service['wrappedHandler'](instance, handler, [
          { sessionId: 'notfound' },
        ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully execute the handler when everything is valid', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };
      const sessionId = 'valid-session';
      const extra = { sessionId };

      // Mock Reflect.hasMetadata to return true for MCP_RESOLVER
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

      mockSession.getSession.mockReturnValue({
        request: { headers: { 'x-test': 'value' }, body: { key: 'value' } },
      });

      // Mock runGuards to resolve successfully
      jest.spyOn(service as any, 'runGuards').mockResolvedValue(undefined);

      const result = await service['wrappedHandler'](instance, handler, [
        extra,
      ] as unknown[]);

      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          headers: { 'x-test': 'value' },
          body: { key: 'value' },
        }),
      );
      expect(service['runGuards']).toHaveBeenCalled();
    });

    it('runGuards should resolve if no guards', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const sessionId = 'abc';
      const request = {} as Request;
      const args: unknown[] = [];

      await expect(
        service['runGuards'](instance, methodName, sessionId, request, args),
      ).resolves.toBeUndefined();
    });

    it('runGuards should throw if guard denies access', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const sessionId = 'abc';
      const request = {} as Request;
      const args: unknown[] = [];
      const guard = { canActivate: jest.fn().mockResolvedValue(false) };

      // Mock Reflect.getMetadata to return the guard
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue([guard]);

      // Mock the private methods that are called inside runGuards
      jest.spyOn(service as any, 'getDecoratorType').mockReturnValue('TOOL');
      jest.spyOn(service as any, 'getHandlerArgs').mockReturnValue({
        sessionId,
        headers: {},
        body: {},
      });

      await expect(
        service['runGuards'](instance, methodName, sessionId, request, args),
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

      it('should register a URI resource without metadata', () => {
        mockResourceMethod = {
          metadata: { name: 'test-uri-resource', uri: 'https://example.com' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockResourceMethod,
        ]);

        service['registerResources'](mockServer as unknown as McpServer);

        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('test-uri-resource'),
          'resources',
        );
        expect(mockServer.resource).toHaveBeenCalledWith(
          'test-uri-resource',
          'https://example.com',
          expect.any(Function),
        );
      });

      it('should register a URI resource with metadata', () => {
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

        service['registerResources'](mockServer as unknown as McpServer);

        expect(mockServer.resource).toHaveBeenCalledWith(
          'test-uri-resource-with-meta',
          'https://example.com',
          { key: 'value' },
          expect.any(Function),
        );
      });

      it('should register a template resource without metadata', () => {
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

        service['registerResources'](mockServer as unknown as McpServer);

        expect(mockServer.resource).toHaveBeenCalledWith(
          'test-template-resource',
          expect.any(ResourceTemplate),
          expect.any(Function),
        );
      });

      it('should register a template resource with metadata', () => {
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

        service['registerResources'](mockServer as unknown as McpServer);

        expect(mockServer.resource).toHaveBeenCalledWith(
          'test-template-resource-with-meta',
          expect.any(ResourceTemplate),
          { key: 'value' },
          expect.any(Function),
        );
      });

      it('should handle errors when registering resources', () => {
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
        mockServer.resource.mockImplementation(() => {
          throw testError;
        });

        service['registerResources'](mockServer as unknown as McpServer);

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

      it('should register a basic prompt', () => {
        mockPromptMethod = {
          metadata: { name: 'test-prompt' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockPromptMethod,
        ]);

        service['registerPrompts'](mockServer as unknown as McpServer);

        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('test-prompt'),
          'prompts',
        );
        expect(mockServer.prompt).toHaveBeenCalledWith(
          'test-prompt',
          expect.any(Function),
        );
      });

      it('should register a prompt with description', () => {
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

        service['registerPrompts'](mockServer as unknown as McpServer);

        expect(mockServer.prompt).toHaveBeenCalledWith(
          'test-prompt-with-description',
          'A test prompt',
          expect.any(Function),
        );
      });

      it('should register a prompt with argsSchema', () => {
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

        service['registerPrompts'](mockServer as unknown as McpServer);

        expect(mockServer.prompt).toHaveBeenCalledWith(
          'test-prompt-with-args',
          { arg1: 'schema' },
          expect.any(Function),
        );
      });

      it('should register a prompt with description and argsSchema', () => {
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

        service['registerPrompts'](mockServer as unknown as McpServer);

        expect(mockServer.prompt).toHaveBeenCalledWith(
          'test-prompt-with-description-and-args',
          'A test prompt',
          { arg1: 'schema' },
          expect.any(Function),
        );
      });

      it('should handle errors when registering prompts', () => {
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
        mockServer.prompt.mockImplementation(() => {
          throw testError;
        });

        service['registerPrompts'](mockServer as unknown as McpServer);

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

      it('should register a basic tool', () => {
        mockToolMethod = {
          metadata: { name: 'test-tool' },
          instance: mockInstance,
          handler: mockHandler,
        };

        mockDiscovery.getAllMethodsWithMetadata.mockReturnValue([
          mockToolMethod,
        ]);

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('test-tool'),
          'tools',
        );
        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool',
          expect.any(Function),
        );
      });

      it('should register a tool with description', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-description',
          'A test tool',
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-params',
          { param1: 'schema' },
          expect.any(Function),
        );
      });

      it('should register a tool with annotations', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-annotations',
          { destructiveHint: true },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema and description', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-params-and-description',
          'A test tool',
          { param1: 'schema' },
          expect.any(Function),
        );
      });

      it('should register a tool with annotations and description', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-annotations-and-description',
          'A test tool',
          { destructiveHint: true },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema and annotations', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-params-and-annotations',
          { param1: 'schema' },
          { destructiveHint: true },
          expect.any(Function),
        );
      });

      it('should register a tool with paramsSchema, annotations, and description', () => {
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'test-tool-with-params-annotations-description',
          'A test tool',
          { param1: 'schema' },
          { destructiveHint: true },
          expect.any(Function),
        );
      });

      it('should handle errors when registering tools', () => {
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
        mockServer.tool.mockImplementation(() => {
          throw testError;
        });

        service['registerTools'](mockServer as unknown as McpServer);

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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'string-tool',
          'Tool with string schema',
          schema,
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'complex-tool',
          'Tool with complex schema',
          schema,
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'enum-tool',
          'Tool with enum schema',
          schema,
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

        service['registerTools'](mockServer as unknown as McpServer);

        expect(mockServer.tool).toHaveBeenCalledWith(
          'nested-tool',
          'Tool with nested schema',
          schema,
          expect.any(Function),
        );
      });
    });
  });

  describe('guard dependency injection', () => {
    /**
     * This test verifies that guards can receive dependencies via NestJS DI.
     * Issue #70: SessionManager injection in guards was not working because
     * guards were instantiated with `new Guard()` instead of using ModuleRef.
     */
    it('should use ModuleRef.get to resolve guards from DI container', async () => {
      // Simple guard that always returns true
      class TestGuard implements CanActivate {
        canActivate(_context: McpExecutionContext): boolean {
          return true;
        }
      }

      const mockSessionManager = new SessionManager();
      const mockDiscoveryService = { getAllMethodsWithMetadata: jest.fn() };
      const mockLoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const mockReflector = new Reflector();

      // Pre-instantiated guard (simulating what DI would return)
      const resolvedGuardInstance = new TestGuard();

      // Mock ModuleRef to return our pre-instantiated guard
      const mockModuleRef = {
        get: jest.fn().mockReturnValue(resolvedGuardInstance),
        create: jest.fn(),
      };

      const registryService = new RegistryService(
        mockDiscoveryService as unknown as DiscoveryService,
        mockLoggerService as unknown as McpLoggerService,
        mockReflector,
        mockSessionManager,
        mockModuleRef as unknown as ModuleRef,
      );

      const sessionId = 'test-session';
      const mockRequest = { headers: {}, body: {} } as unknown as Request;

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
      jest.spyOn(registryService as any, 'getHandlerArgs').mockReturnValue({
        sessionId,
        headers: {},
        body: {},
      });

      // Run guards
      await registryService['runGuards'](
        resolverInstance,
        'testMethod',
        sessionId,
        mockRequest,
        [{ sessionId }],
      );

      // Verify ModuleRef.get was called with the guard class
      expect(mockModuleRef.get).toHaveBeenCalledWith(TestGuard, {
        strict: false,
      });
    });

    it('should inject SessionManager into guards when registered as providers', async () => {
      // Guard that verifies SessionManager was injected
      class SessionAwareGuard implements CanActivate {
        public sessionManagerInjected = false;

        constructor(private sessionManager: SessionManager) {
          this.sessionManagerInjected = sessionManager !== undefined;
        }

        canActivate(_context: McpExecutionContext): boolean {
          if (!this.sessionManager) {
            throw new Error('SessionManager was not injected!');
          }
          // Just verify injection worked, always allow
          return true;
        }
      }

      const mockSessionManager = new SessionManager();
      const mockDiscoveryService = { getAllMethodsWithMetadata: jest.fn() };
      const mockLoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const mockReflector = new Reflector();

      // Pre-instantiated guard WITH SessionManager injected
      const injectedGuard = new SessionAwareGuard(mockSessionManager);
      expect(injectedGuard.sessionManagerInjected).toBe(true);

      // ModuleRef returns the pre-injected guard
      const mockModuleRef = {
        get: jest.fn().mockReturnValue(injectedGuard),
        create: jest.fn(),
      };

      const registryService = new RegistryService(
        mockDiscoveryService as unknown as DiscoveryService,
        mockLoggerService as unknown as McpLoggerService,
        mockReflector,
        mockSessionManager,
        mockModuleRef as unknown as ModuleRef,
      );

      const sessionId = 'test-session';
      const mockRequest = { headers: {}, body: {} } as unknown as Request;

      class TestResolver {
        testMethod(): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();
      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [SessionAwareGuard], TestResolver);

      jest.spyOn(registryService as any, 'getHandlerArgs').mockReturnValue({
        sessionId,
        headers: {},
        body: {},
      });

      // Should NOT throw - the guard should have SessionManager injected
      await expect(
        registryService['runGuards'](
          resolverInstance,
          'testMethod',
          sessionId,
          mockRequest,
          [{ sessionId }],
        ),
      ).resolves.toBeUndefined();

      expect(mockModuleRef.get).toHaveBeenCalled();
    });

    it('should instantiate guards directly when not registered in DI container', async () => {
      class SimpleGuard implements CanActivate {
        canActivate(_context: McpExecutionContext): boolean {
          return true;
        }
      }

      const mockSessionManager = new SessionManager();
      const mockDiscoveryService = {
        getAllMethodsWithMetadata: jest.fn(),
      };
      const mockLoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const mockReflector = new Reflector();
      const mockModuleRef = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Not found in DI');
        }),
        create: jest.fn().mockImplementation(() => {
          throw new Error('Cannot create');
        }),
      };
      const registryService = new RegistryService(
        mockDiscoveryService as unknown as DiscoveryService,
        mockLoggerService as unknown as McpLoggerService,
        mockReflector,
        mockSessionManager,
        mockModuleRef as unknown as ModuleRef,
      );

      const sessionId = 'test-session-simple-guard';
      const mockRequest = { headers: {}, body: {} } as unknown as Request;
      type SessionTransport2 = Parameters<
        typeof mockSessionManager.setSession
      >[1]['transport'];
      mockSessionManager.setSession(sessionId, {
        transport: {} as unknown as SessionTransport2,
        request: mockRequest,
      });

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
      jest.spyOn(registryService as any, 'getHandlerArgs').mockReturnValue({
        sessionId,
        headers: {},
        body: {},
      });

      // Should work via fallback to direct instantiation
      await expect(
        registryService['runGuards'](
          resolverInstance,
          'testMethod',
          sessionId,
          mockRequest,
          [{ sessionId }],
        ),
      ).resolves.toBeUndefined();

      mockSessionManager.deleteSession(sessionId);
    });
  });

  describe('getDecoratorType and getHandlerArgs', () => {
    let mockDiscovery: { getAllMethodsWithMetadata: jest.Mock };
    let mockLogger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
    let mockReflector: Reflector;
    let mockSession: SessionManager;
    let mockModuleRef: { get: jest.Mock; create: jest.Mock };
    let registryService: RegistryService;

    beforeEach(() => {
      mockDiscovery = { getAllMethodsWithMetadata: jest.fn() };
      mockLogger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };
      mockReflector = new Reflector();
      mockSession = new SessionManager();
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
        mockSession,
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

        const result = await registryService['resolveGuard'](
          guardInstance as any,
        );

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
});
