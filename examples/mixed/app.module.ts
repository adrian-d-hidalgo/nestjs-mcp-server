import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';
import { MixedResolver } from './mixed.resolver';

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
  providers: [MixedResolver],
})
export class AppModule {}
