/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
import { Reflector } from '@nestjs/core';
import { Tool, MCP_TOOL } from './tool.decorator';
import { z } from 'zod';

describe('Tool Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  class TestResolver {
    @Tool({ name: 'test_tool' })
    simpleMethod() {
      return { content: [{ type: 'text', text: 'test' }] };
    }

    @Tool({ name: 'tool_with_desc', description: 'A test tool' })
    methodWithDescription() {
      return { content: [{ type: 'text', text: 'test' }] };
    }

    @Tool({
      name: 'tool_with_params',
      paramsSchema: z.object({ id: z.string() }),
    })
    methodWithParams() {
      return { content: [{ type: 'text', text: 'test' }] };
    }

    @Tool({
      name: 'tool_complete',
      description: 'Complete tool',
      paramsSchema: z.object({ id: z.string() }),
    })
    methodComplete() {
      return { content: [{ type: 'text', text: 'test' }] };
    }

    @Tool({
      name: 'tool_with_annotations',
      annotations: { title: 'Developer Tool', readOnlyHint: true },
    })
    methodWithAnnotations() {
      return { content: [{ type: 'text', text: 'test' }] };
    }

    @Tool({ name: 'tool_disabled', enabled: false })
    methodDisabled() {
      return { content: [{ type: 'text', text: 'test' }] };
    }
  }

  it('should set metadata for simple tool', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.simpleMethod,
    );
    expect(metadata).toEqual({
      name: 'test_tool',
      methodName: 'simpleMethod',
    });
  });

  it('should set metadata for tool with description', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.methodWithDescription,
    );
    expect(metadata).toEqual({
      name: 'tool_with_desc',
      description: 'A test tool',
      methodName: 'methodWithDescription',
    });
  });

  it('should set metadata for tool with params schema', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.methodWithParams,
    );
    expect(metadata.name).toBe('tool_with_params');
    expect(metadata.paramsSchema).toBeDefined();
    expect(metadata.methodName).toBe('methodWithParams');
  });

  it('should set metadata for complete tool', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.methodComplete,
    );
    expect(metadata.name).toBe('tool_complete');
    expect(metadata.description).toBe('Complete tool');
    expect(metadata.paramsSchema).toBeDefined();
    expect(metadata.methodName).toBe('methodComplete');
  });

  it('should set metadata for tool with annotations', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.methodWithAnnotations,
    );
    expect(metadata.name).toBe('tool_with_annotations');
    expect(metadata.annotations).toEqual({
      title: 'Developer Tool',
      readOnlyHint: true,
    });
    expect(metadata.methodName).toBe('methodWithAnnotations');
  });

  it('should carry the enabled option into metadata', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.methodDisabled,
    );
    expect(metadata).toEqual({
      name: 'tool_disabled',
      enabled: false,
      methodName: 'methodDisabled',
    });
  });

  it('should not add an enabled key when the option is absent', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      TestResolver.prototype.simpleMethod,
    );
    expect('enabled' in metadata).toBe(false);
  });

  it('captures the 2026-07-28 display and output metadata', () => {
    const OutputSchema = z.object({ value: z.number() });

    class TestResolver {
      @Tool({
        name: 'rich_tool',
        title: 'Rich Tool',
        description: 'Has every option',
        paramsSchema: z.object({ id: z.string() }),
        outputSchema: OutputSchema,
        icons: [{ src: 'https://example.com/i.png', mimeType: 'image/png' }],
        _meta: { 'com.example/team': 'platform' },
      })
      richTool() {
        return { content: [{ type: 'text', text: 'test' }] };
      }
    }

    const metadata = Reflect.getMetadata(
      MCP_TOOL,
      TestResolver.prototype.richTool,
    ) as Record<string, unknown>;

    expect(metadata.title).toBe('Rich Tool');
    expect(metadata.outputSchema).toBe(OutputSchema);
    expect(metadata.icons).toHaveLength(1);
    expect(metadata._meta).toEqual({ 'com.example/team': 'platform' });
  });
});
