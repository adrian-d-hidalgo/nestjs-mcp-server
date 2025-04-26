import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';
import { MixedModule } from './mixed.module';

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
    MixedModule,
  ],
})
export class AppModule {}
