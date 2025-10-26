import { Implementation } from '@modelcontextprotocol/sdk/types.js';
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AsyncLocalStorage } from 'async_hooks';

import {
  MCP_LOGGING_OPTIONS,
  MCP_MODULE_OPTIONS,
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
  ],
})
export class McpCoreModule {
  private static getActiveTransportControllersAndProviders(
    transports?: McpModuleTransportOptions,
  ) {
    const controllers = new Set<Type<any>>();
    const providers = new Set<Provider>();

    const config = {
      streamable: {
        enabled: true,
        ...(transports?.streamable ?? {}),
      },
    };

    if (config.streamable.enabled) {
      controllers.add(StreamableController);
      providers.add(StreamableService);
    }

    return {
      controllers: Array.from(controllers),
      providers: Array.from(providers),
    };
  }

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

  private static createAsyncOptionsProvider(
    options: McpModuleAsyncOptions,
  ): Provider {
    return {
      provide: MCP_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
  }

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
      ],
      global: true,
    };
  }

  static forRootAsync(options: McpModuleAsyncOptions): DynamicModule {
    const { imports = [] } = options;
    const asyncProviders = this.createAsyncProviders(options);
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
        {
          provide: AsyncLocalStorage,
          useValue: new AsyncLocalStorage(),
        },
        ...defaultProviders,
      ],
      global: true,
    };
  }

  static forFeature(_options?: McpFeatureOptions): DynamicModule {
    return {
      module: McpCoreModule,
    };
  }
}
