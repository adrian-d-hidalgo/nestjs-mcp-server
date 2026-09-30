/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Reflector } from '@nestjs/core';
import { Resolver, MCP_RESOLVER } from './resolver.decorator';

describe('Resolver Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('should set metadata with namespace', () => {
    @Resolver('test-namespace')
    class TestResolver {}

    const metadata = reflector.get(MCP_RESOLVER, TestResolver);
    expect(metadata).toBe('test-namespace');
  });

  it('should set metadata without namespace', () => {
    @Resolver()
    class TestResolver {}

    const metadata = reflector.get(MCP_RESOLVER, TestResolver);
    expect(metadata).toBe(true);
  });

  it('should work as class decorator and maintain class functionality', () => {
    @Resolver('my-namespace')
    class MyResolver {
      someMethod() {
        return 'test';
      }
    }

    const instance = new MyResolver();
    expect(instance.someMethod()).toBe('test');
    expect(reflector.get(MCP_RESOLVER, MyResolver)).toBe('my-namespace');
  });

  describe('options object', () => {
    it('keeps MCP_RESOLVER as the name, or true without one', () => {
      @Resolver({ name: 'notes', scopes: ['notes:read'] })
      class Named {}
      @Resolver({ public: true })
      class Unnamed {}

      expect(reflector.get(MCP_RESOLVER, Named)).toBe('notes');
      expect(reflector.get(MCP_RESOLVER, Unnamed)).toBe(true);
    });

    it('validates scope-tokens at declaration', () => {
      expect(() => Resolver({ scopes: ['a b'] as [string] })).toThrow(
        /@Resolver scopes.*scope-token/,
      );
    });

    it('refuses public together with scopes at declaration', () => {
      expect(() => Resolver({ public: true, scopes: ['notes:read'] })).toThrow(
        /@Resolver.*public.*scopes/,
      );
    });
  });
});
