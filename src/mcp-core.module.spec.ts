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
  MCP_REQUEST_SCOPE,
  MCP_SERVER_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
} from './mcp.constants';
import { McpModuleOptions } from './mcp.types';
import { McpController, McpHttpService } from './transports/http';

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

    it('should register the single stateless MCP controller', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
      };

      const module = McpCoreModule.forRoot(options);

      // One endpoint, always. The SSE and streamable transports — and the
      // per-transport enable/disable toggles they needed — were removed in
      // 2.0: HTTP+SSE is inherently sticky-session, which is what issue #121
      // is about. 2025-era clients are served on this same endpoint through
      // the SDK's stateless legacy fallback.
      expect(module.controllers).toEqual([McpController]);
    });

    it('should pass transport options through to the handler token', async () => {
      const options: McpModuleOptions = {
        name: 'test-server',
        version: '1.0.0',
        transport: { legacy: 'reject' },
      };

      const module = McpCoreModule.forRoot(options);

      const transportProvider = module.providers?.find(
        (p: any) => p.provide === MCP_TRANSPORT_OPTIONS,
      ) as any;

      expect(transportProvider.useValue).toEqual({ legacy: 'reject' });
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
          transport: { legacy: 'reject' as const },
        }),
      });

      const transportProvider = moduleDefinition.providers?.find(
        (p: any) => p.provide === MCP_TRANSPORT_OPTIONS,
      ) as any;

      expect(transportProvider).toBeDefined();
      expect(transportProvider.inject).toContain(MCP_MODULE_OPTIONS);

      // The factory must actually read `transport`, not merely exist.
      const factory = transportProvider.useFactory as (
        options: McpModuleOptions,
      ) => unknown;
      expect(
        factory({
          name: 'async-server',
          version: '1.0.0',
          transport: { legacy: 'reject' },
        }),
      ).toEqual({ legacy: 'reject' });
    });

    it('should register the same single controller as forRoot', async () => {
      const moduleDefinition = McpCoreModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '1.0.0',
        }),
      });

      // Both configuration paths now register exactly one controller. In 1.x
      // they disagreed: forRoot omitted a disabled transport's controller
      // while forRootAsync always registered both and relied on the services
      // to no-op, which left GET/DELETE routed even when disabled.
      expect(moduleDefinition.controllers).toEqual([McpController]);
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

      const httpService = testModule.get(McpHttpService);
      expect(httpService).toBeDefined();

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

  describe('stateless wiring', () => {
    it('should provide the HTTP service and the request scope', async () => {
      const testModule: TestingModule = await Test.createTestingModule({
        imports: [McpCoreModule.forRoot({ name: 'wiring', version: '1.0.0' })],
      }).compile();

      expect(testModule.get(McpHttpService)).toBeDefined();

      // The AsyncLocalStorage carrying the Express request from the
      // controller into the per-request server factory. Without it the
      // factory fails closed, so its presence is load-bearing.
      expect(testModule.get(MCP_REQUEST_SCOPE)).toBeDefined();

      await testModule.close();
    });
  });
});
