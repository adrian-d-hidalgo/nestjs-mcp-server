/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MCP_GUARDS, UseGuards } from './user-guard.decorator';

class TestGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

class AnotherGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}

describe('UseGuards Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('should set metadata with single guard on method', () => {
    class TestResolver {
      @UseGuards(TestGuard)
      guardedMethod() {
        return 'test';
      }
    }

    const metadata = reflector.get(
      MCP_GUARDS,
      TestResolver.prototype.guardedMethod,
    );
    expect(metadata).toEqual([TestGuard]);
  });

  it('should set metadata with multiple guards on method', () => {
    class TestResolver {
      @UseGuards(TestGuard, AnotherGuard)
      guardedMethod() {
        return 'test';
      }
    }

    const metadata = reflector.get(
      MCP_GUARDS,
      TestResolver.prototype.guardedMethod,
    );
    expect(metadata).toEqual([TestGuard, AnotherGuard]);
  });

  it('should preserve method functionality', () => {
    class TestResolver {
      @UseGuards(TestGuard)
      guardedMethod() {
        return 'protected';
      }
    }

    const instance = new TestResolver();
    expect(instance.guardedMethod()).toBe('protected');
  });

  it('should set metadata with single guard on class', () => {
    @UseGuards(TestGuard)
    class TestResolver {}

    const metadata = reflector.get(MCP_GUARDS, TestResolver);
    expect(metadata).toEqual([TestGuard]);
  });

  it('should set metadata with multiple guards on class', () => {
    @UseGuards(TestGuard, AnotherGuard)
    class TestResolver {}

    const metadata = reflector.get(MCP_GUARDS, TestResolver);
    expect(metadata).toEqual([TestGuard, AnotherGuard]);
  });
});
