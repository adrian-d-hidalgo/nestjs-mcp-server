import { ExecutionContext } from '@nestjs/common';

import {
  PromptHandlerArgs,
  ResourceTemplateHandlerArgs,
  ResourceUriHandlerArgs,
  ToolHandlerArgs,
} from '../classes';

export interface McpExecutionContext extends ExecutionContext {
  args:
    | ResourceUriHandlerArgs
    | ResourceTemplateHandlerArgs
    | PromptHandlerArgs
    | ToolHandlerArgs;

  getSessionId: () => string | undefined;
}
