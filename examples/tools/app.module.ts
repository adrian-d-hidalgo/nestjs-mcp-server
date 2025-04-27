import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { AppService } from './app.service';

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
  providers: [AppService],
})
export class AppModule {}
