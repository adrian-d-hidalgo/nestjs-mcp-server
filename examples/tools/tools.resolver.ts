import { CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { McpContext, Resolver, Tool } from '../../src';

const ParamsSchema = z.object({ value: z.string() });
type ParamsSchemaType = z.infer<typeof ParamsSchema>;

/**
 * Renders the parts of the handler context that are useful to see over the
 * wire.
 *
 * Deliberately not `JSON.stringify(ctx)`: since 2.0 the context carries the
 * live Express request, which is circular and would throw. Read the fields you
 * need instead.
 */
function describe(ctx: McpContext): string {
  return JSON.stringify({
    method: ctx.mcpReq.method,
    // `undefined` on 2026-07-28 traffic — the spec retired sessions.
    sessionId: ctx.sessionId ?? null,
    userAgent: ctx.headers['user-agent'] ?? null,
  });
}

@Resolver('tools')
export class ToolsResolver {
  /**
   * 1. ToolBaseOptions: Only name
   */
  @Tool({
    name: 'tool_base',
  })
  toolBase(_ctx: McpContext): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolBaseOptions' },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
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
  toolWithDescription(_ctx: McpContext): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithDescriptionOptions' },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
      ],
    };
  }

  /**
   * 3. ToolWithParamsSchemaOptions: name + paramsSchema (Standard Schema)
   */
  @Tool({
    name: 'tool_with_params_schema',
    paramsSchema: ParamsSchema,
  })
  toolWithParamsSchema(
    params: ParamsSchemaType,
    _ctx: McpContext,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithParamsSchemaOptions' },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
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
    _ctx: McpContext,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithParamsSchemaAndDescriptionOptions' },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
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
  toolWithAnnotations(_ctx: McpContext): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithAnnotationsOptions' },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
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
  toolWithAnnotationsAndDescription(_ctx: McpContext): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithAnnotationsAndDescriptionOptions' },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
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
    _ctx: McpContext,
  ): CallToolResult {
    return {
      content: [
        { type: 'text', text: 'ToolWithParamsSchemaAndAnnotationsOptions' },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
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
    _ctx: McpContext,
  ): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: 'ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions',
        },
        { type: 'text', text: `Params: ${JSON.stringify(params)}` },
        { type: 'text', text: `Context: ${describe(_ctx)}` },
      ],
    };
  }
}
