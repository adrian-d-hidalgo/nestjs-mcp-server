import { RequestHandlerExtra } from '../mcp.types';

export class ResourceTemplateHandlerArgs {
  public readonly uri: URL;
  public readonly variables?: Record<string, string>;
  public readonly extra: RequestHandlerExtra;

  private constructor(
    uri: URL,
    extra: RequestHandlerExtra,
    variables?: Record<string, string>,
  ) {
    this.uri = uri;
    this.extra = extra;
    this.variables = variables;
  }

  static from(
    uri: URL,
    extra: RequestHandlerExtra,
    variables?: Record<string, string>,
  ): ResourceTemplateHandlerArgs {
    return new ResourceTemplateHandlerArgs(uri, extra, variables);
  }
}
