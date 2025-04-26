import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

import { McpService } from './mcp.service';

@Controller()
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('mcp')
  async handleMcpPost(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleStreamableRequest(req, res);
  }

  @Get('mcp')
  async handleMcpGet(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleStreamableRequest(req, res);
  }

  @Delete('mcp')
  async handleMcpDelete(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleStreamableRequest(req, res);
  }

  @Get('sse')
  async handleSse(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleSSERequest(req, res);
  }

  @Post('messages')
  async handleMessages(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleSSEMessage(req, res);
  }
}
