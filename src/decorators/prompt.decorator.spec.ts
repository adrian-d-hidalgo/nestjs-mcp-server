/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
import { Reflector } from '@nestjs/core';
import { Prompt, MCP_PROMPT } from './prompt.decorator';
import { z } from 'zod';

describe('Prompt Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  class TestResolver {
    @Prompt({ name: 'test_prompt' })
    simpleMethod() {
      return { messages: [] };
    }

    @Prompt({ name: 'prompt_with_desc', description: 'A test prompt' })
    methodWithDescription() {
      return { messages: [] };
    }

    @Prompt({
      name: 'prompt_with_args',
      argsSchema: { query: z.string() },
    })
    methodWithArgs() {
      return { messages: [] };
    }

    @Prompt({
      name: 'prompt_complete',
      description: 'Complete prompt',
      argsSchema: { query: z.string() },
    })
    methodComplete() {
      return { messages: [] };
    }
  }

  it('should set metadata for simple prompt', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      TestResolver.prototype.simpleMethod,
    );
    expect(metadata).toEqual({
      name: 'test_prompt',
      methodName: 'simpleMethod',
    });
  });

  it('should set metadata for prompt with description', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      TestResolver.prototype.methodWithDescription,
    );
    expect(metadata).toEqual({
      name: 'prompt_with_desc',
      description: 'A test prompt',
      methodName: 'methodWithDescription',
    });
  });

  it('should set metadata for prompt with args schema', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      TestResolver.prototype.methodWithArgs,
    );
    expect(metadata.name).toBe('prompt_with_args');
    expect(metadata.argsSchema).toBeDefined();
    expect(metadata.methodName).toBe('methodWithArgs');
  });

  it('should set metadata for complete prompt', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      TestResolver.prototype.methodComplete,
    );
    expect(metadata.name).toBe('prompt_complete');
    expect(metadata.description).toBe('Complete prompt');
    expect(metadata.argsSchema).toBeDefined();
    expect(metadata.methodName).toBe('methodComplete');
  });
});
