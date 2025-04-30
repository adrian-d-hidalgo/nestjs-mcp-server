import {
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types';
import { CanActivate, Injectable } from '@nestjs/common';

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

    console.log('headers', context.message?.req.headers);
    console.log('query', context.message?.req.query);
    console.log('params', context.message?.req.params);
    console.log('body', context.message?.req.body);

    return true;
  }
}

// Method-level guard
@Injectable()
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
  @Tool({ name: 'logTool' })
  logTool(): CallToolResult {
    return { content: [{ type: 'text', text: 'Tool executed' }] };
  }
}
