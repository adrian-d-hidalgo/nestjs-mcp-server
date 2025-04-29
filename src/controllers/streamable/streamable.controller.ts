import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

import { StreamableService } from './streamable.service';

@Controller()
export class StreamableController {
  constructor(private readonly service: StreamableService) {}

  @Post('mcp')
  async handleMcpPost(@Req() req: Request, @Res() res: Response) {
    await this.service.handlePostRequest(req, res);
  }

  @Get('mcp')
  async handleMcpGet(@Req() req: Request, @Res() res: Response) {
    await this.service.handleGetRequest(req, res);
  }

  @Delete('mcp')
  async handleMcpDelete(@Req() req: Request, @Res() res: Response) {
    await this.service.handleDeleteRequest(req, res);
  }
}
