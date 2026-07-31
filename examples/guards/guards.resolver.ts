import { CallToolResult, GetPromptResult } from '@modelcontextprotocol/server';
import { CanActivate, Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  McpContext,
  McpExecutionContext,
  Prompt,
  Resolver,
  Tool,
  UseGuards,
} from '../../src';

export class ResolverLogGuard implements CanActivate {
  canActivate(_context: any): boolean {
    console.log('[ResolverLogGuard] Resolver-level guard executed');

    return true;
  }
}

export class MethodLogGuard implements CanActivate {
  canActivate(_context: any): boolean {
    console.log('[MethodLogGuard] Method-level guard executed');

    return true;
  }
}

/**
 * Reads the credential off the request the capability was **invoked** on.
 *
 * This replaces the `SessionAwareGuard` this example carried before 2.0, which
 * did `getSessionId()` → `sessionManager.getSession(id)` → `!!session`. Both
 * halves of that are gone: protocol revision 2026-07-28 retired sessions, and
 * with them the in-process session store that made this library impossible to
 * run behind a load balancer.
 *
 * The replacement is strictly stronger. In 1.x the request reachable from a
 * guard was the one that opened the *connection* — the `initialize` POST — so a
 * credential that expired or changed mid-conversation was never re-examined.
 * `getRequest()` now returns this call's own request, so revocable and
 * expiring credentials work as an authorization mechanism should.
 */
@Injectable()
export class AuthHeaderGuard implements CanActivate {
  canActivate(context: any): boolean {
    const request = (context as McpExecutionContext).getRequest();
    const authorization = request.headers.authorization;

    console.log(
      '[AuthHeaderGuard] Authorization on this call:',
      authorization ? 'present' : 'absent',
    );

    return Boolean(authorization);
  }
}

@UseGuards(ResolverLogGuard)
@Resolver('guards')
export class GuardsResolver {
  @Prompt({ name: 'logPrompt' })
  logPrompt(_ctx: McpContext): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: 'Prompt executed' },
        },
      ],
    };
  }

  @UseGuards(MethodLogGuard)
  @Tool({
    name: 'log_tool',
    paramsSchema: z.object({
      prefix: z.string(),
    }),
  })
  logTool(args: { prefix: string }, _ctx: McpContext): CallToolResult {
    return {
      content: [{ type: 'text', text: `[${args.prefix}] Tool executed` }],
    };
  }

  @UseGuards(AuthHeaderGuard)
  @Tool({
    name: 'auth_protected_tool',
    description:
      'A tool protected by a guard that reads this call’s Authorization header',
  })
  authProtectedTool(ctx: McpContext): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Authorized. Method: ${ctx.mcpReq.method}`,
        },
      ],
    };
  }
}
