import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { PromptsModule } from './prompts.module';

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
    PromptsModule,
  ],
})
export class AppModule {}
