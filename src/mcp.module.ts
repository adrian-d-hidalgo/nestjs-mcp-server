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
  McpModuleTransportOption,
  ServerOptions,
} from './interfaces/mcp-server-options.interface';
import { DiscoveryService } from './registry/discovery.service';
import { McpLoggerService } from './registry/mcp-logger.service';
import { McpRegistry } from './registry/mcp.registry';

const STREAMABLE_TRANSPORT: McpModuleTransportOption = {
  controller: StreamableController,
  service: StreamableService,
};

const SSE_TRANSPORT = {
  controller: SseController,
  service: SseService,
};

const DEFAULT_OPTIONS = {
  transports: [STREAMABLE_TRANSPORT, SSE_TRANSPORT],
};

@Module({
  imports: [DiscoveryModule],
  providers: [McpRegistry, DiscoveryService, McpLoggerService],
})
export class McpModule {
  /**
   * Helper to resolve transports from options or defaults
   */
  private static resolveTransports(
    transports?: McpModuleTransportOption[],
  ): McpModuleTransportOption[] {
    return transports && transports.length > 0
      ? transports
      : DEFAULT_OPTIONS.transports;
  }

  /**
   * Helper to build controllers from transports
   */
  private static buildControllers(
    transports: McpModuleTransportOption[],
  ): Type<any>[] {
    return transports.map((t) => t.controller);
  }

  /**
   * Helper to build providers from transports and custom providers
   */
  private static buildProviders(
    transports: McpModuleTransportOption[],
    customProviders?: Array<Provider>,
  ): Array<Provider> {
    const safeCustomProviders = customProviders || [];
    const transportServices = transports.map((t) => t.service);
    return [...safeCustomProviders, ...transportServices];
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
    const transports = this.resolveTransports(options.transports);
    const controllers = this.buildControllers(transports);
    const providers = this.buildProviders(transports, options.providers);

    const { serverInfo, serverOptions, loggingOptions } =
      this.buildServerConfig(options);

    return {
      module: McpModule,
      imports,
      controllers,
      providers: [
        ...providers,
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
      ...args: any[]
    ) => Promise<McpModuleOptions> | McpModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const { imports = [], useFactory, inject = [] } = options;

    const safeInject = Array.isArray(inject) ? inject : [];
    const safeImports = Array.isArray(imports) ? imports : [];

    // Providers for async config
    const providers = [
      {
        provide: 'MCP_SERVER_OPTIONS',
        useFactory: async (...args: any[]) => {
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
        useFactory: async (...args: any[]) => {
          const mcpOptions = await useFactory(...args);
          return {
            enabled: mcpOptions.logging?.enabled !== false,
            level: mcpOptions.logging?.level || 'verbose',
          };
        },
        inject: safeInject,
      },
    ];

    // Map transports to controllers and providers as in forRoot
    const asyncControllersFactory = async (...args: any[]) => {
      const mcpOptions = await useFactory(...args);
      const transports = this.resolveTransports(mcpOptions.transports);

      return this.buildControllers(transports);
    };

    const asyncProvidersFactory = async (...args: any[]) => {
      const mcpOptions = await useFactory(...args);
      const transports = this.resolveTransports(mcpOptions.transports);
      return this.buildProviders(transports, mcpOptions.providers);
    };

    return {
      module: McpModule,
      imports: safeImports,
      controllers: asyncControllersFactory.length
        ? ([] as Array<Type<any>>) // Will be resolved at runtime by NestJS
        : [],
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static forFeature(_options?: McpFeatureOptions): DynamicModule {
    return {
      module: McpModule,
    };
  }
}
