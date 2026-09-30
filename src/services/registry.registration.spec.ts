import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';

import { RegistryService } from './registry.service';
import {
  createPrivateLogicHarness,
  type MockMethod,
  type PrivateLogicHarness,
  requestContext,
} from './registry.service.test-helpers';

describe('RegistryService', () => {
  describe('unit tests for private logic', () => {
    let service: RegistryService;
    let mockDiscovery: PrivateLogicHarness['mockDiscovery'];
    let mockLogger: PrivateLogicHarness['mockLogger'];
    let mockServer: PrivateLogicHarness['mockServer'];

    beforeEach(() => {
      ({ service, mockDiscovery, mockLogger, mockServer } =
        createPrivateLogicHarness());
    });

    afterEach(() => {
      jest.restoreAllMocks();
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
  });
});
