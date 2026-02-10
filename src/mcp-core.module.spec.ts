/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';

import { McpCoreModule } from './mcp-core.module';
import {
  MCP_LOGGING_OPTIONS,
  MCP_MODULE_OPTIONS,
  MCP_SERVER_OPTIONS,
  MCP_SESSION_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
} from './mcp.constants';
import { McpModuleOptions } from './mcp.types';
import { SessionManager } from './services/session.manager';
import { SseController, SseService } from './transports/sse';
import {
  StreamableController,
  StreamableService,
} from './transports/streamable';

describe('McpCoreModule', () => {
  describe('forRoot', () => {
    it('should create module with basic options', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.module).toBe(McpCoreModule);
      expect(module.global).toBe(true);
    });

    it('should enable both transports by default', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.controllers).toContain(StreamableController);
      expect(module.controllers).toContain(SseController);
    });

    it('should disable streamable transport when configured', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        transports: {
          streamable: { enabled: false },
        },
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.controllers).not.toContain(StreamableController);
      expect(module.controllers).toContain(SseController);
    });

    it('should disable SSE transport when configured', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        transports: {
          sse: { enabled: false },
        },
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.controllers).toContain(StreamableController);
      expect(module.controllers).not.toContain(SseController);
    });

    it('should disable all transports when configured', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        transports: {
          streamable: { enabled: false },
          sse: { enabled: false },
        },
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.controllers).not.toContain(StreamableController);
      expect(module.controllers).not.toContain(SseController);
      expect(module.controllers).toHaveLength(0);
    });

    it('should include custom providers', async () => {
      const customProvider = { provide: 'CUSTOM', useValue: 'test' };
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        providers: [customProvider],
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.providers).toContainEqual(customProvider);
    });

    it('should configure logging options', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        logging: {
          enabled: false,
          level: 'error',
        },
      };

      const module = McpCoreModule.forRoot(options);

      const loggingProvider = module.providers?.find(
        (p: any) => p.provide === MCP_LOGGING_OPTIONS,
      ) as any;

      expect(loggingProvider.useValue).toEqual({
        enabled: false,
        level: 'error',
      });
    });

    it('should use default logging options when not specified', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
      };

      const module = McpCoreModule.forRoot(options);

      const loggingProvider = module.providers?.find(
        (p: any) => p.provide === MCP_LOGGING_OPTIONS,
      ) as any;

      expect(loggingProvider.useValue).toEqual({
        enabled: true,
        level: 'verbose',
      });
    });

    it('should configure server options with instructions and capabilities', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        instructions: 'Test instructions',
        capabilities: {
          tools: {},
        },
      };

      const module = McpCoreModule.forRoot(options);

      const serverOptionsProvider = module.providers?.find(
        (p: any) => p.provide === MCP_SERVER_OPTIONS,
      ) as any;

      expect(serverOptionsProvider.useValue.serverInfo).toEqual({
        name: 'test-server',
        version: '1.0.0',
      });
      expect(serverOptionsProvider.useValue.options.instructions).toBe(
        'Test instructions',
      );
      expect(serverOptionsProvider.useValue.options.capabilities).toEqual({
        tools: {},
      });
    });
  });

  describe('forRootAsync', () => {
    it('should create module with async factory', async () => {
      const module = McpCoreModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '2.0.0',
        }),
      });

      expect(module.module).toBe(McpCoreModule);
      expect(module.global).toBe(true);
    });

    it('should inject dependencies into factory', async () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue('test-value'),
      };

      const moduleDefinition = McpCoreModule.forRootAsync({
        imports: [],
        useFactory: (config: typeof mockConfigService) => ({
          name: config.get('MCP_NAME'),
          version: '1.0.0',
        }),
        inject: ['ConfigService'],
      });

      // Verify the async options provider is created correctly
      const optionsProvider = moduleDefinition.providers?.find(
        (p: any) => p.provide === MCP_MODULE_OPTIONS,
      ) as any;

      expect(optionsProvider).toBeDefined();
      expect(optionsProvider.inject).toContain('ConfigService');
    });

    it('should create logging options provider from async config', async () => {
      const moduleDefinition = McpCoreModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '1.0.0',
          logging: { enabled: true, level: 'debug' },
        }),
      });

      const loggingProvider = moduleDefinition.providers?.find(
        (p: any) => p.provide === MCP_LOGGING_OPTIONS,
      ) as any;

      expect(loggingProvider).toBeDefined();
      expect(loggingProvider.inject).toContain(MCP_MODULE_OPTIONS);
    });

    it('should create transport options provider from async config', async () => {
      const moduleDefinition = McpCoreModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '1.0.0',
          transports: { sse: { enabled: false } },
        }),
      });

      const transportProvider = moduleDefinition.providers?.find(
        (p: any) => p.provide === MCP_TRANSPORT_OPTIONS,
      ) as any;

      expect(transportProvider).toBeDefined();
      expect(transportProvider.inject).toContain(MCP_MODULE_OPTIONS);
    });

    it('should include default controllers for async config', async () => {
      const moduleDefinition = McpCoreModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '1.0.0',
        }),
      });

      // forRootAsync uses default controllers (both enabled)
      expect(moduleDefinition.controllers).toContain(StreamableController);
      expect(moduleDefinition.controllers).toContain(SseController);
    });

    it('should include all required providers for async config', async () => {
      const moduleDefinition = McpCoreModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '1.0.0',
        }),
      });

      const providerTokens = moduleDefinition.providers?.map((p: any) =>
        typeof p === 'function' ? p.name : p.provide,
      );

      expect(providerTokens).toContain(MCP_MODULE_OPTIONS);
      expect(providerTokens).toContain(MCP_LOGGING_OPTIONS);
      expect(providerTokens).toContain(MCP_TRANSPORT_OPTIONS);
      expect(providerTokens).toContain(MCP_SERVER_OPTIONS);
    });

    it('should work with real NestJS TestingModule', async () => {
      const testModule: TestingModule = await Test.createTestingModule({
        imports: [
          McpCoreModule.forRootAsync({
            useFactory: () => ({
              name: 'integration-test-server',
              version: '1.0.0',
            }),
          }),
        ],
      }).compile();

      const sessionManager = testModule.get(SessionManager);
      expect(sessionManager).toBeDefined();

      const mcpOptions = testModule.get(MCP_MODULE_OPTIONS);
      expect(mcpOptions.name).toBe('integration-test-server');
    });

    it('should resolve async factory with Promise', async () => {
      const testModule: TestingModule = await Test.createTestingModule({
        imports: [
          McpCoreModule.forRootAsync({
            useFactory: async () => {
              // Simulate async config loading
              await new Promise((resolve) => setTimeout(resolve, 10));
              return {
                name: 'promise-server',
                version: '3.0.0',
              };
            },
          }),
        ],
      }).compile();

      const mcpOptions = testModule.get(MCP_MODULE_OPTIONS);
      expect(mcpOptions.name).toBe('promise-server');
      expect(mcpOptions.version).toBe('3.0.0');
    });
  });

  describe('forFeature', () => {
    it('should return minimal module configuration', () => {
      const module = McpCoreModule.forFeature();

      expect(module.module).toBe(McpCoreModule);
    });

    it('should accept options parameter', () => {
      const module = McpCoreModule.forFeature({});

      expect(module.module).toBe(McpCoreModule);
    });
  });

  describe('buildServerConfig', () => {
    it('should build config with protocol options', () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        protocolOptions: {
          enforceStrictCapabilities: true,
        },
      };

      const module = McpCoreModule.forRoot(options);

      const serverOptionsProvider = module.providers?.find(
        (p: any) => p.provide === MCP_SERVER_OPTIONS,
      ) as any;

      expect(
        serverOptionsProvider.useValue.options.enforceStrictCapabilities,
      ).toBe(true);
    });
  });

  describe('getActiveTransportControllersAndProviders', () => {
    it('should return correct services for enabled transports', () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        transports: {
          streamable: { enabled: true },
          sse: { enabled: true },
        },
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.providers).toContainEqual(StreamableService);
      expect(module.providers).toContainEqual(SseService);
    });

    it('should not include disabled transport services', () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        transports: {
          streamable: { enabled: false },
          sse: { enabled: false },
        },
      };

      const module = McpCoreModule.forRoot(options);

      expect(module.providers).not.toContainEqual(StreamableService);
      expect(module.providers).not.toContainEqual(SseService);
    });
  });
});
