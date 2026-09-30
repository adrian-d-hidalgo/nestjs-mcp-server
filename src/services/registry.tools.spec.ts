import { McpServer } from '@modelcontextprotocol/server';

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
});
