import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Request } from 'express';

import { McpModule } from '../../src/mcp.module';
import { GuardsResolver, SessionAwareGuard } from './guards.resolver';

@Injectable()
export class GlobalLogGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    console.log('Global guard executed', '[GlobalLogGuard]');

    const request = context.switchToHttp().getRequest<Request>();

    console.log('headers', request.headers);
    console.log('params', request.params);
    console.log('body', request.body);

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
    SessionAwareGuard,
    GuardsResolver,
  ],
})
export class AppModule {}
