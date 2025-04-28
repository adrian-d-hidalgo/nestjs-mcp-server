import { CanActivate } from '@nestjs/common';

import {
  McpExecutionContext,
  Prompt,
  Resolver,
  Tool,
  UseGuards,
} from '../../src';

import {
  CallToolResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types';

// Resolver-level guard
export class ResolverLogGuard implements CanActivate {
  canActivate(_context: McpExecutionContext): boolean {
    console.log('[ResolverLogGuard] Resolver-level guard executed');
    return true;
  }
}

// Method-level guard
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
