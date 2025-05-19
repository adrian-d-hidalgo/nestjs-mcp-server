import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

import { McpLoggerService } from '../../services/logger.service';
import { SseService } from './sse.service';

@Controller()
export class SseController {
  constructor(
    private readonly logger: McpLoggerService,
    private readonly service: SseService,
  ) {}

  @Get('sse')
  async handleSse(@Req() req: Request, @Res() res: Response) {
    this.logger.log('[SSE] Connection established');
    await this.service.handleSse(req, res);
  }

  @Post('messages')
  async handleMessages(@Req() req: Request, @Res() res: Response) {
    this.logger.log('[SSE] Message received');
    await this.service.handleMessage(req, res);
  }
}
