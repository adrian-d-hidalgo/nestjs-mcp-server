import { Implementation } from '@modelcontextprotocol/sdk/types';
import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import {
  McpFeatureOptions,
  McpLoggingOptions,
  McpServerModuleOptions,
  ServerOptions,
} from './interfaces/mcp-server-options.interface';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { DiscoveryService } from './registry/discovery.service';
import { McpLoggerService } from './registry/mcp-logger.service';
import { McpRegistry } from './registry/mcp.registry';

const DEFAULT_OPTIONS = {
  serverInfo: {
    name: 'nest-mcp-server',
    version: '1.0.0',
  },
  options: {
    instructions: 'MCP server powered by NestJS',
  },
  logging: {
    enabled: true,
    level: 'verbose',
  } as McpLoggingOptions,
};

@Module({
  imports: [DiscoveryModule],
  providers: [
    McpRegistry,
    DiscoveryService,
    McpLoggerService,
    {
      provide: 'MCP_SERVER_OPTIONS',
      useValue: DEFAULT_OPTIONS,
    },
    {
      provide: 'MCP_LOGGING_OPTIONS',
      useValue: DEFAULT_OPTIONS.logging,
    },
    McpService,
  ],
  controllers: [McpController],
})
export class McpModule {
  /**
   * Configures the MCP module with global options
   *
   * @param options Configuration options for the MCP server
   * @returns Dynamic module configuration
   */
  static forRoot(options: McpServerModuleOptions): DynamicModule {
    const providers = options?.providers || [];
    const imports = options?.imports || [];

    const serverInfo: Implementation = {
      name: options.name,
      version: options.version,
    };

    const serverOptions: ServerOptions = {
      instructions: options?.instructions,
      capabilities: options?.capabilities,
      ...(options?.protocolOptions || {}),
    };

    // Logging configurations
    const loggingOptions: McpLoggingOptions = {
      enabled: options.logging?.enabled !== false,
      level: options.logging?.level || 'verbose',
    };

    return {
      module: McpModule,
      imports,
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
    ) => Promise<McpServerModuleOptions> | McpServerModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const { imports = [], useFactory, inject = [] } = options;
    const safeImports = Array.isArray(imports) ? imports : [];
    const safeInject = Array.isArray(inject) ? inject : [];

    const providers = [
      {
        provide: 'MCP_SERVER_OPTIONS',
        useFactory: async (...args: any[]) => {
          const mcpOptions = await useFactory(...args);
          const serverInfo: Implementation = {
            name: mcpOptions.name,
            version: mcpOptions.version,
          };

          const serverOptions: ServerOptions = {
            instructions: mcpOptions?.instructions,
            capabilities: mcpOptions?.capabilities,
            ...(mcpOptions?.protocolOptions || {}),
          };

          // Logging configurations
          const loggingOptions: McpLoggingOptions = {
            enabled: mcpOptions.logging?.enabled !== false,
            level: mcpOptions.logging?.level || 'verbose',
          };

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

    // Add additional providers if available
    if (safeInject.length > 0) {
      // We can't spread safeInject directly due to TypeScript type checking
      // So we add providers one by one if needed
    }

    return {
      module: McpModule,
      imports: safeImports,
      providers,
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
