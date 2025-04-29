import { Implementation } from '@modelcontextprotocol/sdk/types';
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { SseController, SseService } from './controllers/sse';
import {
  StreamableController,
  StreamableService,
} from './controllers/streamable';
import {
  McpFeatureOptions,
  McpLoggingOptions,
  McpModuleOptions,
  McpModuleTransportOptions,
  ServerOptions,
} from './interfaces/mcp-server-options.interface';
import { DiscoveryService } from './registry/discovery.service';
import { McpLoggerService } from './registry/logger.service';
import { RegistryService } from './registry/registry.service';

@Module({
  imports: [DiscoveryModule],
  providers: [RegistryService, DiscoveryService, McpLoggerService],
})
export class McpModule {
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
      module: McpModule,
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
  static forRootAsync(options: {
    imports?: any[];
    useFactory: (
      ...args: unknown[]
    ) => Promise<McpModuleOptions> | McpModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const { imports = [], useFactory, inject = [] } = options;
    const safeInject = Array.isArray(inject) ? inject : [];
    const safeImports = Array.isArray(imports) ? imports : [];
    const providers = [
      {
        provide: 'MCP_SERVER_OPTIONS',
        useFactory: async (...args: unknown[]) => {
          const mcpOptions = await useFactory(...args);
          const { serverInfo, serverOptions, loggingOptions } =
            this.buildServerConfig(mcpOptions);
          return {
            serverInfo,
            options: serverOptions,
            logging: loggingOptions,
          };
        },
        inject: safeInject,
      },
      {
        provide: 'MCP_LOGGING_OPTIONS',
        useFactory: async (...args: unknown[]) => {
          const mcpOptions = await useFactory(...args);
          return {
            enabled: mcpOptions.logging?.enabled !== false,
            level: mcpOptions.logging?.level || 'verbose',
          };
        },
        inject: safeInject,
      },
    ];
    const asyncControllersFactory = async (...args: unknown[]) => {
      const mcpOptions = await useFactory(...args);
      return this.getActiveTransportControllersAndProviders(
        mcpOptions.transports,
      ).controllers;
    };
    const asyncProvidersFactory = async (...args: unknown[]) => {
      const mcpOptions = await useFactory(...args);
      const { providers } = this.getActiveTransportControllersAndProviders(
        mcpOptions.transports,
      );
      return [...(mcpOptions.providers || []), ...providers];
    };
    return {
      module: McpModule,
      imports: safeImports,
      controllers: [], // Will be resolved at runtime by NestJS
      providers: [
        ...providers,
        {
          provide: '__MCP_ASYNC_CONTROLLERS__',
          useFactory: asyncControllersFactory,
          inject: safeInject,
        },
        {
          provide: '__MCP_ASYNC_PROVIDERS__',
          useFactory: asyncProvidersFactory,
          inject: safeInject,
        },
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
      module: McpModule,
    };
  }
}
