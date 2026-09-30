import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  MCP_TOOL,
  McpExecutionContext,
  McpGuard,
  ToolOptions,
} from '../../src';
import { OAUTH_EXAMPLE_CONFIG, OAuthExampleConfig } from './oauth.config';

/**
 * DEMO: the application's own per-tool authorization (Layer 2b), distinct from
 * the OAuth layers before it — the authorization server's client and scope
 * policy, and the library's per-tool `scopes` check.
 *
 * Refuses every tool named in `OAUTH_FORCE_UNAUTHORIZED`, for every caller,
 * whatever scopes their token holds. It runs only after the scope check has
 * passed, so a token lacking the tool's scopes still gets the library's
 * `403 insufficient_scope` first.
 */
@Injectable()
export class ForceUnauthorizedGuard implements McpGuard {
  constructor(
    @Inject(OAUTH_EXAMPLE_CONFIG) private readonly config: OAuthExampleConfig,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: McpExecutionContext): boolean {
    const tool = this.reflector.get<ToolOptions | undefined>(
      MCP_TOOL,
      context.getHandler(),
    )?.name;

    if (tool !== undefined && this.config.forceUnauthorized.includes(tool)) {
      throw new ForbiddenException(
        `Denied by OAUTH_FORCE_UNAUTHORIZED (tool "${tool}")`,
      );
    }
    return true;
  }
}
