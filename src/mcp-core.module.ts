import { Implementation } from '@modelcontextprotocol/server';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AsyncLocalStorage } from 'async_hooks';

import {
  MCP_LOGGING_OPTIONS,
  MCP_MODULE_OPTIONS,
  MCP_REQUEST_SCOPE,
  MCP_SERVER_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
} from './mcp.constants';
import {
  McpFeatureOptions,
  McpLoggingOptions,
  McpModuleAsyncOptions,
  McpModuleOptions,
  ServerOptions,
} from './mcp.types';
import { DiscoveryService } from './services/discovery.service';
import { McpLoggerService } from './services/logger.service';
import { RegistryService } from './services/registry.service';
import { McpController, McpHttpService } from './transports/http';

/**
 * Providers shared by both configuration paths.
 *
 * The request-scope `AsyncLocalStorage` is provided under a dedicated token
 * rather than the bare `AsyncLocalStorage` class, so it is typed at the
 * injection site and cannot collide with another module's store.
 */
const CORE_PROVIDERS: Provider[] = [
  RegistryService,
  DiscoveryService,
  McpLoggerService,
  McpHttpService,
  {
    provide: MCP_REQUEST_SCOPE,
    useValue: new AsyncLocalStorage(),
  },
];

@Module({
  imports: [DiscoveryModule],
  providers: CORE_PROVIDERS,
})
export class McpCoreModule {
  /**
   * Helper to build server info, options, and logging config
   */
  private static buildServerConfig(options: McpModuleOptions) {
    const serverInfo: Implementation = {
      name: options.name,
      version: options.version,
    };
    // `server` last: it is the escape hatch to the SDK's own `ServerOptions`,
    // so anything set there wins over the convenience fields above.
    const serverOptions: ServerOptions = {
      instructions: options?.instructions,
      capabilities: options?.capabilities,
      ...(options?.protocolOptions || {}),
      ...(options?.server || {}),
    };
    const loggingOptions: McpLoggingOptions = {
      enabled: options.logging?.enabled !== false,
      level: options.logging?.level || 'verbose',
    };
    return { serverInfo, serverOptions, loggingOptions };
  }

  /**
   * Helper: Create async options provider
   */
  private static createAsyncOptionsProvider(
    options: McpModuleAsyncOptions,
  ): Provider {
    return {
      provide: MCP_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
  }

  /**
   * Helper: Create all async providers
   */
  private static createAsyncProviders(
    options: McpModuleAsyncOptions,
  ): Provider[] {
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: MCP_LOGGING_OPTIONS,
        useFactory: (mcpOptions: McpModuleOptions) => ({
          enabled: mcpOptions.logging?.enabled !== false,
          level: mcpOptions.logging?.level || 'verbose',
        }),
        inject: [MCP_MODULE_OPTIONS],
      },
      {
        provide: MCP_TRANSPORT_OPTIONS,
        useFactory: (mcpOptions: McpModuleOptions) => mcpOptions.transport,
        inject: [MCP_MODULE_OPTIONS],
      },
      {
        provide: MCP_SERVER_OPTIONS,
        useFactory: (mcpOptions: McpModuleOptions) => {
          const { serverInfo, serverOptions, loggingOptions } =
            McpCoreModule.buildServerConfig(mcpOptions);
          return {
            serverInfo,
            options: serverOptions,
            logging: loggingOptions,
          };
        },
        inject: [MCP_MODULE_OPTIONS],
      },
    ];
  }

  /**
   * Configures the MCP module with global options
   *
   * @param options Configuration options for the MCP server
   * @returns Dynamic module configuration
   */
  static forRoot(options: McpModuleOptions): DynamicModule {
    const imports = options.imports || [];
    const { serverInfo, serverOptions, loggingOptions } =
      this.buildServerConfig(options);
    return {
      module: McpCoreModule,
      imports,
      controllers: [McpController],
      providers: [
        ...(options.providers || []),
        {
          provide: MCP_SERVER_OPTIONS,
          useValue: {
            serverInfo,
            options: serverOptions,
            logging: loggingOptions,
          },
        },
        {
          provide: MCP_LOGGING_OPTIONS,
          useValue: loggingOptions,
        },
        {
          provide: MCP_TRANSPORT_OPTIONS,
          useValue: options.transport,
        },
      ],
      global: true,
    };
  }

  /**
   * Configures the MCP module with global options and ConfigModule support
   * Allows using environment variables and centralized configurations
   *
   * @param options Configuration options for the MCP server
   * @returns Dynamic module configuration
   */
  static forRootAsync(options: McpModuleAsyncOptions): DynamicModule {
    const { imports = [] } = options;
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: McpCoreModule,
      imports,
      controllers: [McpController],
      providers: [...asyncProviders, ...CORE_PROVIDERS],
      global: true,
    };
  }

  /**
   * Registers feature-specific capabilities like tools, prompts, and resources
   * through dedicated service providers
   *
   * @param options Configuration options for the feature module
   * @returns A dynamic module configuration
   */
  // TODO: Implement specific Module options

  static forFeature(_options?: McpFeatureOptions): DynamicModule {
    return {
      module: McpCoreModule,
    };
  }
}
