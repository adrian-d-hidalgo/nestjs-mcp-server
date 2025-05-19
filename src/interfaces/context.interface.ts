import { ExecutionContext } from '@nestjs/common';

import {
  PromptHandlerArgs,
  ResourceTemplateHandlerArgs,
  ResourceUriHandlerArgs,
  ToolHandlerArgs,
} from '../classes';
/**
 * Custom execution context for MCP guards.
 * Extends NestJS ExecutionContext and adds args for MCP method arguments.
 *
 * @property args - The arguments passed to the MCP method
 * @property message - The current message from the request
 */
// TODO: Remove extends ExecutionContext we don't need it
export interface McpExecutionContext extends ExecutionContext {
  // TODO: Remove this once the getArgs method implementation is complete.
  args:
    | ResourceUriHandlerArgs
    | ResourceTemplateHandlerArgs
    | PromptHandlerArgs
    | ToolHandlerArgs;

  // TODO: Uncomment this once the getArgs type is fixed
  // getArgs: () =>
  //   | ResourceUriHandlerArgs
  //   | ResourceTemplateHandlerArgs
  //   | PromptHandlerArgs
  //   | ToolHandlerArgs;

  getSessionId: () => string;
}
