import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

import { McpMessage } from '../interfaces/message.types';
import { McpLoggerService } from '../registry/logger.service';
import { MessageService } from '../services/message.service';
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: McpLoggerService,
    private readonly messageService: MessageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    let message: McpMessage | undefined;

    this.logger.log(
      `Request path: ${request.path}`,
      '[RequestContextInterceptor]',
    );

    switch (request.path) {
      case '/sse':
        this.logger.log(
          'SSE connection detected',
          '[RequestContextInterceptor]',
        );

        message = {
          req: request,
          res: response,
        };

        this.messageService.set(message);

        break;
      case '/messages':
        this.logger.log('SSE message received', '[RequestContextInterceptor]');

        message = {
          req: request,
          res: response,
        };

        this.messageService.set(message);

        break;
      case '/mcp':
        this.logger.log('MCP request detected', '[RequestContextInterceptor]');
        // TODO: Handle MCP request
        break;
      default:
        this.logger.log(
          `Regular request: ${request.method} ${request.url}`,
          '[RequestContextInterceptor]',
        );
        break;
    }

    return next.handle();
  }
}
