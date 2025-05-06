import {
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types';
import { CanActivate } from '@nestjs/common';
import { z } from 'zod';

import {
  McpExecutionContext,
  Prompt,
  RequestHandlerExtra,
  Resolver,
  Tool,
  UseGuards,
} from '../../src';

// Resolver-level guard
// Applies to all methods in the resolver
export class ResolverLogGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    console.log('[ResolverLogGuard] Resolver-level guard executed');

    console.log('sessionId', context.getSessionId());
    // Args as a structured object, mapped by parameter names for predictable access
    console.log('headers', context.args);

    // Args as a raw array, ordered as passed to the resolver method
    console.log('extra', context.getArgs());

    return true;
  }
}

// Method-level guard
// Applies to a single method in the resolver but it has the same context as the resolver-level guard
export class MethodLogGuard implements CanActivate {
  canActivate(_context: McpExecutionContext): boolean {
    console.log('[MethodLogGuard] Method-level guard executed');

    return true;
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
    paramSchema: {
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
}
