import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

import { SseService } from './sse.service';

@Controller()
export class SseController {
  constructor(private readonly service: SseService) {}

  @Get('sse')
  async handleSse(@Req() req: Request, @Res() res: Response) {
    await this.service.handleSse(req, res);
  }

  @Post('messages')
  async handleMessages(@Req() req: Request, @Res() res: Response) {
    await this.service.handleMessage(req, res);
  }
}
