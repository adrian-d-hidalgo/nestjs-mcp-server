import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DiscoveryModule, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

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

    it('should call registerResources, registerPrompts, registerTools in registerAll', async () => {
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

      await service.registerAll(server);

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
      service = new RegistryService(
        mockDiscovery as unknown as DiscoveryService,
        mockLogger as unknown as McpLoggerService,
        mockReflector as unknown as Reflector,
        mockSession as unknown as SessionManager,
      );
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
      const request: unknown = {};
      const args: unknown[] = [];

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sessionId,
          request as any,
          args,
        ),
      ).resolves.toBeUndefined();
    });

    it('runGuards should throw if guard denies access', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const sessionId = 'abc';
      const request: unknown = {};
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
        service['runGuards'](
          instance,
          methodName,
          sessionId,
          request as any,
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
  });
});
