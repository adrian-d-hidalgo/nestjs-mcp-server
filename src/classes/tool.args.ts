import { z, ZodRawShape, ZodTypeAny } from 'zod';

import { RequestHandlerExtra } from '../mcp.types';

export class ToolHandlerArgs<Args extends ZodRawShape | undefined = undefined> {
  public readonly args?: Args extends ZodRawShape
    ? z.objectOutputType<Args, ZodTypeAny>
    : undefined;
  public readonly extra: RequestHandlerExtra;

  private constructor(
    extra: RequestHandlerExtra,
    args?: Args extends ZodRawShape
      ? z.objectOutputType<Args, ZodTypeAny>
      : undefined,
  ) {
    this.extra = extra;
    this.args = args;
  }

  static from<Args extends ZodRawShape | undefined>(
    extra: RequestHandlerExtra,
    args?: Args extends ZodRawShape
      ? z.objectOutputType<Args, ZodTypeAny>
      : undefined,
  ): ToolHandlerArgs<Args> {
    return new ToolHandlerArgs<Args>(extra, args);
  }
}
