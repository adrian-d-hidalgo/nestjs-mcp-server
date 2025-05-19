import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

import { RequestHandlerExtra, Resolver, Tool } from '../../src';

const ParamsSchema = { value: z.string() };
type ParamsSchemaType = typeof ParamsSchema;

@Resolver('tools')
export class ToolsResolver {
  /**
   * 1. ToolBaseOptions: Only name
   */
  @Tool({
    name: 'tool_base',
  })
  toolBase(_extra: RequestHandlerExtra): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolBaseOptions' },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 2. ToolWithDescriptionOptions: name + description
   */
  @Tool({
    name: 'tool_with_description',
    description: 'Tool with name and description',
  })
  toolWithDescription(_extra: RequestHandlerExtra): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithDescriptionOptions' },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 3. ToolWithParamsSchemaOptions: name + paramsSchema (ZodRawShape)
   */
  @Tool({
    name: 'tool_with_params_schema',
    paramsSchema: ParamsSchema,
  })
  toolWithParamsSchema(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithParamsSchemaOptions' },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 4. ToolWithParamsSchemaAndDescriptionOptions: name + paramsSchema + description
   */
  @Tool({
    name: 'tool_with_params_schema_and_description',
    description: 'Tool with paramsSchema and description',
    paramsSchema: ParamsSchema,
  })
  toolWithParamsSchemaAndDescription(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithParamsSchemaAndDescriptionOptions' },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 5. ToolWithAnnotationsOptions: name + annotations
   */
  @Tool({
    name: 'tool_with_annotations',
    annotations: { destructiveHint: true },
  })
  toolWithAnnotations(_extra: RequestHandlerExtra): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithAnnotationsOptions' },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 6. ToolWithAnnotationsAndDescriptionOptions: name + annotations + description
   */
  @Tool({
    name: 'tool_with_annotations_and_description',
    description: 'Tool with annotations and description',
    annotations: { destructiveHint: true },
  })
  toolWithAnnotationsAndDescription(
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithAnnotationsAndDescriptionOptions' },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 7. ToolWithParamsSchemaAndAnnotationsOptions: name + paramsSchema + annotations
   */
  @Tool({
    name: 'tool_with_params_schema_and_annotations',
    paramsSchema: ParamsSchema,
    annotations: { destructiveHint: true },
  })
  toolWithParamsSchemaAndAnnotations(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithParamsSchemaAndAnnotationsOptions' },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }

  /**
   * 8. ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions: name + paramsSchema + annotations + description
   */
  @Tool({
    name: 'tool_with_params_schema_and_annotations_and_description',
    description: 'Tool with paramsSchema, annotations, and description',
    paramsSchema: ParamsSchema,
    annotations: { destructiveHint: true },
  })
  toolWithParamsSchemaAndAnnotationsAndDescription(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: 'ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions',
        },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Extra: ${JSON.stringify(_extra)}` },
      ],
    };
  }
}
