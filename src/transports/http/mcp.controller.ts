import { All, Controller, Req, Res } from '@nestjs/common';
import { Response } from 'express';

import type { AuthenticatedRequest } from '../../interfaces/handler-context.interface';
import { McpHttpService } from './mcp-http.service';

/**
 * The single MCP endpoint.
 *
 * `@All` rather than separate `@Post`/`@Get`/`@Delete` handlers: method
 * semantics belong to the protocol, not to the router. The SDK answers `405`
 * for `GET` and `DELETE` — which were the 2025-era session operations — and
 * `415` for a non-JSON POST. Letting Nest 404 those instead would be a
 * different, less accurate answer.
 *
 * Mounted as a controller rather than middleware on purpose: Nest middleware
 * runs *before* guards, so mounting there would silently stop application-wide
 * `APP_GUARD` guards from ever seeing MCP traffic.
 */
@Controller()
export class McpController {
  constructor(private readonly service: McpHttpService) {}

  @All('mcp')
  async handleMcp(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.service.handle(req, res);
  }
}
