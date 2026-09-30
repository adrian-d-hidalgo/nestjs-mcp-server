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
      argsSchema: z.object({ query: z.string() }),
    })
    methodWithArgs() {
      return { messages: [] };
    }

    @Prompt({
      name: 'prompt_complete',
      description: 'Complete prompt',
      argsSchema: z.object({ query: z.string() }),
    })
    methodComplete() {
      return { messages: [] };
    }

    @Prompt({ name: 'prompt_disabled', enabled: false })
    methodDisabled() {
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

  it('should carry the enabled option into metadata', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      TestResolver.prototype.methodDisabled,
    );
    expect(metadata).toEqual({
      name: 'prompt_disabled',
      enabled: false,
      methodName: 'methodDisabled',
    });
  });

  it('should not add an enabled key when the option is absent', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      TestResolver.prototype.simpleMethod,
    );
    expect('enabled' in metadata).toBe(false);
  });

  it.each([
    ['a space', ['notes:read notes:write']],
    ['a quote', ['notes"read']],
    ['a control character', ['notes\u0000read']],
    ['an empty scope', ['']],
    ['no scope at all', []],
  ])('rejects scopes holding %s at declaration', (_label, scopes) => {
    expect(() =>
      Prompt({ name: 'bad', scopes } as unknown as Parameters<
        typeof Prompt
      >[0]),
    ).toThrow(/@Prompt "bad" scopes.*scope-token/);
  });

  it('accepts valid scope-tokens', () => {
    expect(() =>
      Prompt({
        name: 'good',
        scopes: ['notes:read', 'https://x/y'],
      }),
    ).not.toThrow();
  });

  it('refuses public together with scopes at declaration', () => {
    expect(() =>
      Prompt({ name: 'both', public: true, scopes: ['notes:read'] }),
    ).toThrow(/@Prompt "both".*public.*scopes/);
  });
});
