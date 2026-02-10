import { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AsyncLocalStorage } from 'async_hooks';

import {
  MCP_LOGGING_OPTIONS,
  MCP_MODULE_OPTIONS,
  MCP_SESSION_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
} from './mcp.constants';
import {
  McpFeatureOptions,
  McpLoggingOptions,
  McpModuleAsyncOptions,
  McpModuleOptions,
  McpModuleTransportOptions,
  ServerOptions,
} from './mcp.types';
import { DiscoveryService } from './services/discovery.service';
import { McpLoggerService } from './services/logger.service';
import { RegistryService } from './services/registry.service';
import { SessionManager } from './services/session.manager';
import { SseController, SseService } from './transports/sse';
import {
  StreamableController,
  StreamableService,
} from './transports/streamable';

@Module({
  imports: [DiscoveryModule],
  providers: [
    RegistryService,
    DiscoveryService,
    {
      provide: AsyncLocalStorage,
      useValue: new AsyncLocalStorage(),
    },
    McpLoggerService,
    SessionManager,
  ],
  exports: [SessionManager],
})
export class McpCoreModule {
  /**
   * Helper: Get active transport controllers and providers
   */
  private static getActiveTransportControllersAndProviders(
    transports?: McpModuleTransportOptions,
  ) {
    const controllers = new Set<Type<any>>();
    const providers = new Set<Provider>();

    // Transport configurations
    const STREAMABLE_TRANSPORT = {
      controller: StreamableController,
      service: StreamableService,
    };

    const SSE_TRANSPORT = {
      controller: SseController,
      service: SseService,
    };

    // Default configuration
    const defaultTransports: McpModuleTransportOptions = {
      streamable: { enabled: true },
      sse: { enabled: true },
    };

    // Merge default with provided transports
    const config = {
      streamable: {
        ...defaultTransports.streamable,
        ...(transports?.streamable ?? {}),
      },
      sse: {
        ...defaultTransports.sse,
        ...(transports?.sse ?? {}),
      },
    };

    // Add controllers and providers based on enabled transports
    if (config.streamable.enabled) {
      controllers.add(STREAMABLE_TRANSPORT.controller);
      providers.add(STREAMABLE_TRANSPORT.service);
    }

    if (config.sse.enabled) {
      controllers.add(SSE_TRANSPORT.controller);
      providers.add(SSE_TRANSPORT.service);
    }

    return {
      controllers: Array.from(controllers),
      providers: Array.from(providers),
    };
  }

  /**
   * Helper to build server info, options, and logging config
   */
  private static buildServerConfig(options: McpModuleOptions) {
    const serverInfo: Implementation = {
      name: options.name,
      version: options.version,
    };
    const serverOptions: ServerOptions = {
      instructions: options?.instructions,
      capabilities: options?.capabilities,
      ...(options?.protocolOptions || {}),
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
        useFactory: (mcpOptions: McpModuleOptions) => mcpOptions.transports,
        inject: [MCP_MODULE_OPTIONS],
      },
      {
        provide: MCP_SESSION_OPTIONS,
        useFactory: (mcpOptions: McpModuleOptions) => ({
          sessionTimeoutMs: mcpOptions.session?.sessionTimeoutMs ?? 1800000,
          cleanupIntervalMs: mcpOptions.session?.cleanupIntervalMs ?? 300000,
          maxConcurrentSessions:
            mcpOptions.session?.maxConcurrentSessions ?? 1000,
        }),
        inject: [MCP_MODULE_OPTIONS],
      },
      {
        provide: 'MCP_SERVER_OPTIONS',
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
    const { controllers, providers } =
      this.getActiveTransportControllersAndProviders(options.transports);
    const allProviders = [...(options.providers || []), ...providers];
    const { serverInfo, serverOptions, loggingOptions } =
      this.buildServerConfig(options);
    return {
      module: McpCoreModule,
      imports,
      controllers,
      providers: [
        ...allProviders,
        {
          provide: 'MCP_SERVER_OPTIONS',
          useValue: {
            serverInfo,
            options: serverOptions,
            logging: loggingOptions,
          },
        },
        {
          provide: 'MCP_LOGGING_OPTIONS',
          useValue: loggingOptions,
        },
        {
          provide: 'MCP_TRANSPORT_OPTIONS',
          useValue: options.transports,
        },
        {
          provide: 'MCP_SESSION_OPTIONS',
          useValue: {
            sessionTimeoutMs: options.session?.sessionTimeoutMs ?? 1800000,
            cleanupIntervalMs: options.session?.cleanupIntervalMs ?? 300000,
            maxConcurrentSessions:
              options.session?.maxConcurrentSessions ?? 1000,
          },
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
    // Synchronously resolve controllers/providers using a factory function
    const defaultControllers =
      McpCoreModule.getActiveTransportControllersAndProviders().controllers;
    const defaultProviders =
      McpCoreModule.getActiveTransportControllersAndProviders().providers;
    return {
      module: McpCoreModule,
      imports,
      controllers: defaultControllers,
      providers: [
        ...asyncProviders,
        RegistryService,
        DiscoveryService,
        McpLoggerService,
        SessionManager,
        {
          provide: AsyncLocalStorage,
          useValue: new AsyncLocalStorage(),
        },
        ...defaultProviders,
      ],
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
