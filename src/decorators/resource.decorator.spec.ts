/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Reflector } from '@nestjs/core';
import { Resource, MCP_RESOURCE } from './resource.decorator';

describe('Resource Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  class TestResolver {
    @Resource({ name: 'test_resource', uri: 'resource://test/data' })
    uriMethod() {
      return { contents: [] };
    }

    @Resource({
      name: 'resource_with_metadata',
      uri: 'resource://test/data',
      metadata: { version: '1.0' },
    })
    uriWithMetadataMethod() {
      return { contents: [] };
    }

    @Resource({ name: 'template_resource', template: 'resource://test/{id}' })
    templateMethod() {
      return { contents: [] };
    }

    @Resource({
      name: 'template_with_metadata',
      template: 'resource://test/{id}',
      metadata: { version: '1.0' },
    })
    templateWithMetadataMethod() {
      return { contents: [] };
    }

    @Resource({
      name: 'disabled_resource',
      uri: 'resource://test/data',
      enabled: false,
    })
    disabledMethod() {
      return { contents: [] };
    }
  }

  it('should set metadata for resource with URI', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      TestResolver.prototype.uriMethod,
    );
    expect(metadata).toEqual({
      name: 'test_resource',
      uri: 'resource://test/data',
      methodName: 'uriMethod',
    });
  });

  it('should set metadata for resource with URI and metadata', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      TestResolver.prototype.uriWithMetadataMethod,
    );
    expect(metadata).toEqual({
      name: 'resource_with_metadata',
      uri: 'resource://test/data',
      metadata: { version: '1.0' },
      methodName: 'uriWithMetadataMethod',
    });
  });

  it('should set metadata for resource with template', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      TestResolver.prototype.templateMethod,
    );
    expect(metadata).toEqual({
      name: 'template_resource',
      template: 'resource://test/{id}',
      methodName: 'templateMethod',
    });
  });

  it('should set metadata for resource with template and metadata', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      TestResolver.prototype.templateWithMetadataMethod,
    );
    expect(metadata).toEqual({
      name: 'template_with_metadata',
      template: 'resource://test/{id}',
      metadata: { version: '1.0' },
      methodName: 'templateWithMetadataMethod',
    });
  });

  it('should carry the enabled option into metadata', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      TestResolver.prototype.disabledMethod,
    );
    expect(metadata).toEqual({
      name: 'disabled_resource',
      uri: 'resource://test/data',
      enabled: false,
      methodName: 'disabledMethod',
    });
  });

  it('should not add an enabled key when the option is absent', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      TestResolver.prototype.uriMethod,
    );
    expect('enabled' in metadata).toBe(false);
  });

  it('captures a resource cache hint', () => {
    class TestResolver {
      @Resource({
        name: 'cached',
        uri: 'res://cached',
        cacheHint: { ttlMs: 1000, cacheScope: 'public' },
      })
      cached() {
        return { contents: [] };
      }
    }

    const metadata = Reflect.getMetadata(
      MCP_RESOURCE,
      TestResolver.prototype.cached,
    ) as Record<string, unknown>;

    expect(metadata.cacheHint).toEqual({ ttlMs: 1000, cacheScope: 'public' });
  });
});
