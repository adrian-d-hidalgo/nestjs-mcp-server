import { ExecutionContext } from '@nestjs/common';

import {
  PromptHandlerParams,
  ResourceTemplateHandlerParams,
  ResourceUriHandlerParams,
  ToolHandlerParams,
} from './capabilities.interface';
import { McpMessage } from './message.types';
/**
 * Custom execution context for MCP guards.
 * Extends NestJS ExecutionContext and adds args for MCP method arguments.
 *
 * @property args - The arguments passed to the MCP method
 * @property message - The current message from the request
 */
// TODO: Type Args correctly
export interface McpExecutionContext extends ExecutionContext {
  /** The session ID from the request */
  sessionId?: string;

  params:
    | ResourceUriHandlerParams
    | ResourceTemplateHandlerParams
    | PromptHandlerParams
    | ToolHandlerParams;

  /** The current message from the request */
  message: McpMessage | undefined;
}
