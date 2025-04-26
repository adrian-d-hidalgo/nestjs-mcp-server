import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { PromptsService } from './prompts.service';

@Module({
  imports: [
    McpModule.forFeature({
      capabilities: [PromptsService],
    }),
  ],
})
export class PromptsModule {}
