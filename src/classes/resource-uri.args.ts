import { RequestHandlerExtra } from '../mcp.types';

export class ResourceUriHandlerArgs {
  public readonly uri: URL;
  public readonly extra: RequestHandlerExtra;

  private constructor(uri: URL, extra: RequestHandlerExtra) {
    this.uri = uri;
    this.extra = extra;
  }

  static from(uri: URL, extra: RequestHandlerExtra): ResourceUriHandlerArgs {
    return new ResourceUriHandlerArgs(uri, extra);
  }
}
