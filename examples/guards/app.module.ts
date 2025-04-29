import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Module,
} from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';

import { APP_GUARD } from '@nestjs/core';
import { GuardsResolver } from './guards.resolver';

// Global guard (to be registered in app.module.ts)
@Injectable()
export class GlobalLogGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // This will log for every request (NestJS global guard)
    // You can add more context-specific logic if needed

    console.log('[GlobalLogGuard] Global guard executed');
    return true;
  }
}

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
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalLogGuard,
    },
    GuardsResolver,
  ],
})
export class AppModule {}
