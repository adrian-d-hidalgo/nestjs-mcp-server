import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { ResourcesService } from './resources.service';

@Module({
  imports: [
    McpModule.forFeature({
      capabilities: [ResourcesService],
    }),
  ],
})
export class ResourcesModule {}
