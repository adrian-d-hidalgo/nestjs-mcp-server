import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService, registerAs } from '@nestjs/config';

import { McpModule } from '../../src/mcp.module';
import { McpLoggingOptions } from '../../src/mcp.types';

// Using registerAs to create a namespaced configuration
export const mcpConfig = registerAs('mcpServer', () => ({
  name: 'Async Import Example',
  version: '1.0.0',
  logging: {
    enabled: true,
    level: 'debug' as 'debug' | 'verbose' | 'log' | 'warn' | 'error',
  },
}));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [mcpConfig],
    }),
    McpModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const name = configService.get<string>('mcpServer.name');
        const version = configService.get<string>('mcpServer.version');
        const enabled = configService.get<boolean>('mcpServer.logging.enabled');
        const level = configService.get<McpLoggingOptions['level']>(
          'mcpServer.logging.level',
        );

        return {
          name: name || 'Async Import Default',
          version: version || '1.0.0',
          logging: {
            enabled: enabled !== undefined ? enabled : false,
            level: level || 'debug',
          },
        };
      },
    }),
  ],
})
export class AppModule {}
