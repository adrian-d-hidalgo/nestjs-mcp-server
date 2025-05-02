import { ExecutionContext } from '@nestjs/common';

import {
  PromptHandlerParams,
  ResourceTemplateHandlerParams,
  ResourceUriHandlerParams,
  ToolHandlerParams,
} from './capabilities.interface';
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
    | ResourceUriHandlerParams
    | ResourceTemplateHandlerParams
    | PromptHandlerParams
    | ToolHandlerParams;

  // TODO: Uncomment this once the getArgs type is fixed
  // getArgs: () =>
  //   | ResourceUriHandlerParams
  //   | ResourceTemplateHandlerParams
  //   | PromptHandlerParams
  //   | ToolHandlerParams;

  getSessionId: () => string;
}
