import { DynamicModule, Module } from '@nestjs/common';

import { McpCoreModule } from './mcp-core.module';
import { McpFeatureOptions, McpModuleOptions } from './mcp.types';

@Module({})
export class McpModule {
  /**
   * Configure the MCP module synchronously
   */
  static forRoot(options: McpModuleOptions): DynamicModule {
    return {
      module: McpModule,
      imports: [McpCoreModule.forRoot(options)],
    };
  }

  /**
   * Configure the MCP module asynchronously (e.g. with ConfigModule)
   */
  static forRootAsync(options: {
    imports?: any[];
    useFactory: (
      ...args: unknown[]
    ) => Promise<McpModuleOptions> | McpModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: McpModule,
      imports: [McpCoreModule.forRootAsync(options)],
    };
  }

  /**
   * Register feature-specific capabilities (tools, prompts, resources)
   */
  static forFeature(options?: McpFeatureOptions): DynamicModule {
    const coreFeatureModule = McpCoreModule.forFeature(options);
    return {
      module: McpModule,
      imports: coreFeatureModule.imports ?? [],
      providers: coreFeatureModule.providers,
      exports: coreFeatureModule.exports,
    };
  }
}
