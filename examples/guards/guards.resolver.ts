import {
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types';
import { CanActivate, Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  McpExecutionContext,
  Prompt,
  RequestHandlerExtra,
  Resolver,
  SessionManager,
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

@Injectable()
export class SessionAwareGuard implements CanActivate {
  constructor(private readonly sessionManager: SessionManager) {}

  canActivate(context: any): boolean {
    const sessionId = (context as McpExecutionContext).getSessionId();
    const session = this.sessionManager.getSession(sessionId);

    console.log(
      '[SessionAwareGuard] Session check:',
      session ? 'valid' : 'invalid',
    );

    // Allow if session exists
    return !!session;
  }
}

@UseGuards(ResolverLogGuard)
@Resolver('guards')
export class GuardsResolver {
  @Prompt({ name: 'logPrompt' })
  logPrompt(_extra: RequestHandlerExtra): GetPromptResult {
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
    paramsSchema: {
      prefix: z.string(),
    },
  })
  logTool(
    args: { prefix: string },
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [{ type: 'text', text: `[${args.prefix}] Tool executed` }],
    };
  }

  @UseGuards(SessionAwareGuard)
  @Tool({
    name: 'session_protected_tool',
    description: 'A tool protected by a guard that uses SessionManager via DI',
  })
  sessionProtectedTool(extra: RequestHandlerExtra): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Session validated! SessionId: ${extra.sessionId}`,
        },
      ],
    };
  }
}
