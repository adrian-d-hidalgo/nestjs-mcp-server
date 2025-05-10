import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';
import { ToolsResolver } from './tools.resolver';

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
  ],
  providers: [ToolsResolver],
})
export class AppModule {}
