import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { z } from 'zod';

import { RequestHandlerExtra, Resolver, Tool } from '../../src';

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
    paramsSchemaOrAnnotations: { value: z.string() },
  })
  toolWithParamSchemaOrAnnotations(
    params: {
      value: string;
    },
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
    paramsSchemaOrAnnotations: { value: z.string() },
    description: 'Tool with paramSchemaOrAnnotations and description',
  })
  toolWithParamSchemaOrAnnotationsAndDescription(
    params: {
      value: string;
    },
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
    paramsSchema: { value: z.string() },
    annotations: { destructiveHint: true },
  })
  toolWithParamAndAnnotations(
    params: {
      value: string;
    },
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
    paramsSchema: { value: z.string() },
    annotations: { destructiveHint: true },
    description: 'Tool with paramSchema, annotations, and description',
  })
  toolWithParamAndAnnotationsAndDescription(
    params: {
      value: string;
    },
    _extra: RequestHandlerExtra,
  ): CallToolResult {
    return {
      content: [{ type: 'text', text: `Params: ${JSON.stringify(params)}` }],
    };
  }
}
