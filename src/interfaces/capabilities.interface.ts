import {
  CompleteResourceTemplateCallback,
  ListResourcesCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra as SdkRequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import {
  z,
  ZodOptional,
  ZodRawShape,
  ZodType,
  ZodTypeAny,
  ZodTypeDef,
} from 'zod';

export interface ResourceBaseOptions {
  name: string;
}

export interface ResourceUriOptions extends ResourceBaseOptions {
  uri: string;
}

export interface ResourceUriWithMetadataOptions extends ResourceUriOptions {
  metadata: Record<string, any>;
}

export interface ResourceTemplateOptions extends ResourceBaseOptions {
  template: string;
}

export interface ResourceTemplateWithMetadataOptions
  extends ResourceTemplateOptions {
  metadata: Record<string, any>;
}

export type ResourceOptions =
  | ResourceUriOptions
  | ResourceUriWithMetadataOptions
  | ResourceTemplateOptions
  | ResourceTemplateWithMetadataOptions;

export interface ToolNameOptions {
  name: string;
}

export interface ToolWithDescriptionOptions extends ToolNameOptions {
  description: string;
}

export interface ToolWithParamSchemaOptions extends ToolNameOptions {
  paramSchema: ZodRawShape;
}

export interface ToolWithDescriptionAndParamSchemaOptions
  extends ToolWithDescriptionOptions,
    ToolWithParamSchemaOptions {}

export type ToolOptions =
  | ToolNameOptions
  | ToolWithDescriptionOptions
  | ToolWithParamSchemaOptions
  | ToolWithDescriptionAndParamSchemaOptions;

export interface PromptBaseOptions {
  name: string;
}

export interface PromptWithDescriptionOptions extends PromptBaseOptions {
  description: string;
}

type PromptArgsRawShape = {
  [k: string]:
    | ZodType<string, ZodTypeDef, string>
    | ZodOptional<ZodType<string, ZodTypeDef, string>>;
};

export interface PromptWithArgsSchemaOptions extends PromptBaseOptions {
  argsSchema: PromptArgsRawShape;
}

export interface PromptWithDescriptionAndArgsSchemaOptions
  extends PromptWithDescriptionOptions,
    PromptWithArgsSchemaOptions {}

export type PromptOptions =
  | PromptBaseOptions
  | PromptWithDescriptionOptions
  | PromptWithArgsSchemaOptions
  | PromptWithDescriptionAndArgsSchemaOptions;

export interface TemplateCallbacks {
  /**
   * A callback to list all resources matching this template. This is required to specified, even if `undefined`, to avoid accidentally forgetting resource listing.
   */
  list: ListResourcesCallback | undefined;
  /**
   * An optional callback to autocomplete variables within the URI template. Useful for clients and users to discover possible values.
   */
  complete?: {
    [variable: string]: CompleteResourceTemplateCallback;
  };
}

export type RequestHandlerExtra = SdkRequestHandlerExtra<
  ServerRequest,
  ServerNotification
> & {
  headers: Record<string, string>;
};

// TODO: This is not an interface
export class ResourceUriHandlerParams {
  public readonly uri: URL;
  public readonly extra: RequestHandlerExtra;

  private constructor(uri: URL, extra: RequestHandlerExtra) {
    this.uri = uri;
    this.extra = extra;
  }

  static from(uri: URL, extra: RequestHandlerExtra): ResourceUriHandlerParams {
    return new ResourceUriHandlerParams(uri, extra);
  }
}

// TODO: This is not an interface
export class ResourceTemplateHandlerParams {
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
  ): ResourceTemplateHandlerParams {
    return new ResourceTemplateHandlerParams(uri, extra, variables);
  }
}

// TODO: This is not an interface
export class PromptHandlerParams<
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
  ): PromptHandlerParams<Args> {
    return new PromptHandlerParams<Args>(extra, args);
  }
}

// TODO: This is not an interface
export class ToolHandlerParams<
  Args extends ZodRawShape | undefined = undefined,
> {
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
  ): ToolHandlerParams<Args> {
    return new ToolHandlerParams<Args>(extra, args);
  }
}
