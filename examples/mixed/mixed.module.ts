import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { MixedService } from './mixed.service';

@Module({
  imports: [
    McpModule.forFeature({
      capabilities: [MixedService],
    }),
  ],
})
export class MixedModule {}
