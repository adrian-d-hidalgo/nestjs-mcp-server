import { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';

import { PromptArgsRawShape, RequestHandlerExtra } from '../mcp.types';

export class PromptHandlerArgs<
  Args extends PromptArgsRawShape | undefined = undefined,
> {
  public readonly args?: Args extends PromptArgsRawShape
    ? ShapeOutput<Args>
    : undefined;
  public readonly extra: RequestHandlerExtra;

  private constructor(
    extra: RequestHandlerExtra,
    args?: Args extends PromptArgsRawShape ? ShapeOutput<Args> : undefined,
  ) {
    this.extra = extra;
    this.args = args;
  }

  static from<Args extends PromptArgsRawShape | undefined>(
    extra: RequestHandlerExtra,
    args?: Args extends PromptArgsRawShape ? ShapeOutput<Args> : undefined,
  ): PromptHandlerArgs<Args> {
    return new PromptHandlerArgs<Args>(extra, args);
  }
}
