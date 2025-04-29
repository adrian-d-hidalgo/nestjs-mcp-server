import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { McpModule } from '../../src/mcp.module';

@Module({
  imports: [
    McpModule.forRootAsync({
      imports: [ConfigModule.forRoot()],
      useFactory: (configService: ConfigService) => ({
        name: 'tools',
        version: '1.0.0',
        logging: {
          enabled: configService.get('MCP_LOGGING_ENABLED'),
          level: configService.get('MCP_LOGGING_LEVEL'),
        },
      }),
    }),
  ],
})
export class AppModule {}
