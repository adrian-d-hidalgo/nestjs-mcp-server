import {
  ShapeOutput,
  ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';

import { RequestHandlerExtra } from '../mcp.types';

export class ToolHandlerArgs<
  Args extends ZodRawShapeCompat | undefined = undefined,
> {
  public readonly args?: Args extends ZodRawShapeCompat
    ? ShapeOutput<Args>
    : undefined;
  public readonly extra: RequestHandlerExtra;

  private constructor(
    extra: RequestHandlerExtra,
    args?: Args extends ZodRawShapeCompat ? ShapeOutput<Args> : undefined,
  ) {
    this.extra = extra;
    this.args = args;
  }

  static from<Args extends ZodRawShapeCompat | undefined>(
    extra: RequestHandlerExtra,
    args?: Args extends ZodRawShapeCompat ? ShapeOutput<Args> : undefined,
  ): ToolHandlerArgs<Args> {
    return new ToolHandlerArgs<Args>(extra, args);
  }
}
