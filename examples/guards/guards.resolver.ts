import {
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types';
import { CanActivate, Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  McpExecutionContext,
  Prompt,
  Resolver,
  Tool,
  UseGuards,
} from '../../src';

// Resolver-level guard
@Injectable()
export class ResolverLogGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    console.log('[ResolverLogGuard] Resolver-level guard executed');

    console.log('sessionId', context.sessionId);
    console.log('params', context.params);

    return true;
  }
}

// Method-level guard
@Injectable()
export class MethodLogGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    console.log('[MethodLogGuard] Method-level guard executed');

    console.log('sessionId', context.sessionId);
    console.log('params', context.params);

    return true;
  }
}

@UseGuards(ResolverLogGuard)
@Resolver('guards')
export class GuardsResolver {
  @Prompt({ name: 'logPrompt' })
  logPrompt(): GetPromptResult {
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
    name: 'logTool',
    paramSchema: {
      prefix: z.string(),
    },
  })
  logTool(args: { prefix: string }): CallToolResult {
    return {
      content: [{ type: 'text', text: `[${args.prefix}] Tool executed` }],
    };
  }
}
