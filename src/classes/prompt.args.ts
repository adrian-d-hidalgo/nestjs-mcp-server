import { z, ZodTypeAny } from 'zod';

import { PromptArgsRawShape, RequestHandlerExtra } from '../mcp.types';

export class PromptHandlerArgs<
  Args extends PromptArgsRawShape | undefined = undefined,
> {
  public readonly args?: Args extends PromptArgsRawShape
    ? z.objectOutputType<Args, ZodTypeAny>
    : undefined;
  public readonly extra: RequestHandlerExtra;

  private constructor(
    extra: RequestHandlerExtra,
    args?: Args extends PromptArgsRawShape
      ? z.objectOutputType<Args, ZodTypeAny>
      : undefined,
  ) {
    this.extra = extra;
    this.args = args;
  }

  static from<Args extends PromptArgsRawShape | undefined>(
    extra: RequestHandlerExtra,
    args?: Args extends PromptArgsRawShape
      ? z.objectOutputType<Args, ZodTypeAny>
      : undefined,
  ): PromptHandlerArgs<Args> {
    return new PromptHandlerArgs<Args>(extra, args);
  }
}
