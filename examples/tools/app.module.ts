import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { ToolsModule } from './tools.module';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'tools',
      version: '1.0.0',
      logging: {
        enabled: true,
        level: 'verbose',
      },
    }),
    ToolsModule,
  ],
})
export class AppModule {}
