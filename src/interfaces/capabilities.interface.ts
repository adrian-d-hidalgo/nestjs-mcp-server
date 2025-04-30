import {
  CompleteResourceTemplateCallback,
  ListResourcesCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { ZodOptional, ZodRawShape, ZodType, ZodTypeDef } from 'zod';

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
