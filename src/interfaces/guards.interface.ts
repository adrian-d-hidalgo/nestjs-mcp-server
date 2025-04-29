import { ExecutionContext } from '@nestjs/common';

/**
 * Custom execution context for MCP guards.
 * Extends NestJS ExecutionContext and adds args for MCP method arguments.
 *
 * @property args - The arguments passed to the MCP method
 */
// TODO: Type Args correctly
export interface McpExecutionContext extends ExecutionContext {
  /** The arguments passed to the MCP method */
  args: unknown[];
}
