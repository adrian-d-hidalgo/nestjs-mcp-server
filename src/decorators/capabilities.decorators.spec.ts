import { Test, TestingModule } from '@nestjs/testing';
import 'reflect-metadata';
import { z } from 'zod';

import { MCP_PROMPT, MCP_RESOURCE, MCP_TOOL } from './capabilities.constants';
import {
  MCP_GUARDS,
  MCP_RESOLVER,
  Prompt,
  Resolver,
  Resource,
  Tool,
  UseGuards,
} from './capabilities.decorators';

describe('MCP Decorators', () => {
  it('should apply Resolver metadata', () => {
    @Resolver('test')
    class TestClass {}

    expect(Reflect.getMetadata(MCP_RESOLVER, TestClass)).toBe('test');
  });

  it('should apply UseGuards metadata', () => {
    class Guard {}

    @UseGuards(Guard)
    class TestClass {}

    expect(Reflect.getMetadata(MCP_GUARDS, TestClass)).toContain(Guard);
  });

  it('should apply Tool metadata in a Nest module', async () => {
    const schema = { foo: z.string() };

    @Resolver('test')
    class TestClass {
      @Tool({ name: 'tool', paramsSchema: schema })
      toolMethod() {}
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [TestClass],
    }).compile();

    const instance = module.get(TestClass);
    const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;

    let metadataUnknown: unknown = Reflect.getMetadata(
      MCP_TOOL,
      proto,
      'toolMethod',
    );

    if (!metadataUnknown) {
      metadataUnknown = Reflect.getMetadata(
        MCP_TOOL,
        proto['toolMethod'] as object,
      );
    }

    const metadata = metadataUnknown as { name?: string } | undefined;

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('tool');
  });

  it('should apply Prompt metadata in a Nest module', async () => {
    @Resolver('test')
    class TestClass {
      @Prompt({ name: 'prompt' })
      promptMethod() {}
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [TestClass],
    }).compile();

    const instance = module.get(TestClass);
    const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;

    let metadataUnknown: unknown = Reflect.getMetadata(
      MCP_PROMPT,
      proto,
      'promptMethod',
    );

    if (!metadataUnknown) {
      metadataUnknown = Reflect.getMetadata(
        MCP_PROMPT,
        proto['promptMethod'] as object,
      );
    }

    const metadata = metadataUnknown as { name?: string } | undefined;

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('prompt');
  });

  it('should apply Resource metadata in a Nest module', async () => {
    @Resolver('test')
    class TestClass {
      @Resource({ name: 'resource', uri: 'resource://test' })
      resourceMethod() {}
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [TestClass],
    }).compile();

    const instance = module.get(TestClass);
    const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;

    let metadataUnknown: unknown = Reflect.getMetadata(
      MCP_RESOURCE,
      proto,
      'resourceMethod',
    );

    if (!metadataUnknown) {
      metadataUnknown = Reflect.getMetadata(
        MCP_RESOURCE,
        proto['resourceMethod'] as object,
      );
    }

    const metadata = metadataUnknown as { name?: string } | undefined;

    expect(metadata).toBeDefined();
    expect(metadata?.name).toBe('resource');
  });
});
