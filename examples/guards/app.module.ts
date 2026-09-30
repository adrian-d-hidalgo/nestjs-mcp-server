import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Request } from 'express';

import { McpModule } from '../../src/mcp.module';
import { GuardsResolver, AuthHeaderGuard } from './guards.resolver';

@Injectable()
export class GlobalLogGuard implements CanActivate {
  private readonly logger = new Logger(GlobalLogGuard.name);

  canActivate(context: ExecutionContext): boolean {
    // Global guards receive standard ExecutionContext
    // For HTTP contexts (including MCP over HTTP), switchToHttp() works
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as { method?: string } | undefined;

    // A summary, not the raw headers: those may carry credentials.
    this.logger.debug(
      `Global guard executed: ${request.method} ${request.path} (MCP method: ${body?.method ?? 'none'})`,
    );

    return true;
  }
}

@Module({
  imports: [
    McpModule.forRoot({
      name: 'guards',
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
    AuthHeaderGuard,
    GuardsResolver,
  ],
})
export class AppModule {}
