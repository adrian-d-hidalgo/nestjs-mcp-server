import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { ResourcesModule } from './resources.module';

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
    ResourcesModule,
  ],
})
export class AppModule {}
