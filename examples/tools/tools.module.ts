import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { ToolsService } from './tools.service';

@Module({
  imports: [
    McpModule.forFeature({
      capabilities: [ToolsService],
    }),
  ],
})
export class ToolsModule {}
