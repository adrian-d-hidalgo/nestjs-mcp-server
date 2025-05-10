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
    return { content: [{ type: 'text', text: 'ToolBaseOptions' }] };
  }

  /**
   * 2. ToolWithDescriptionOptions: name + description
   */
  @Tool({
    name: 'tool_with_description',
    description: 'Tool with name and description',
  })
  toolWithDescription(_extra: RequestHandlerExtra): CallToolResult {
    return { content: [{ type: 'text', text: 'ToolWithDescriptionOptions' }] };
  }

  /**
   * 3. ToolWithParamOrAnnotationsOptions: name + paramsSchemaOrAnnotations (ZodRawShape)
   */
  @Tool({
    name: 'tool_with_param_schema_or_annotations',
    paramsSchemaOrAnnotations: ParamsSchema,
  })
  toolWithParamSchemaOrAnnotations(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [{ type: 'text', text: `Params: ${JSON.stringify(params)}` }],
    };
  }

  /**
   * 4. ToolWithParamOrAnnotationsAndDescriptionOptions: name + paramsSchemaOrAnnotations + description
   */
  @Tool({
    name: 'tool_with_param_schema_or_annotations_and_description',
    description: 'Tool with paramSchemaOrAnnotations and description',
    paramsSchemaOrAnnotations: ParamsSchema,
  })
  toolWithParamSchemaOrAnnotationsAndDescription(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [{ type: 'text', text: `Params: ${JSON.stringify(params)}` }],
    };
  }

  /**
   * 5. ToolWithParamAndAnnotationsOptions: name + paramsSchema + annotations
   */
  @Tool({
    name: 'tool_with_param_and_annotations',
    paramsSchema: ParamsSchema,
    annotations: { destructiveHint: true },
  })
  toolWithParamAndAnnotations(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [{ type: 'text', text: `Params: ${JSON.stringify(params)}` }],
    };
  }

  /**
   * 6. ToolWithParamAndAnnotationsAndDescriptionOptions: name + paramsSchema + annotations + description
   */
  @Tool({
    name: 'tool_with_param_and_annotations_and_description',
    description: 'Tool with paramSchema, annotations, and description',
    paramsSchema: ParamsSchema,
    annotations: { destructiveHint: true },
  })
  toolWithParamAndAnnotationsAndDescription(
    params: ParamsSchemaType,
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [{ type: 'text', text: `Params: ${JSON.stringify(params)}` }],
    };
  }
}
