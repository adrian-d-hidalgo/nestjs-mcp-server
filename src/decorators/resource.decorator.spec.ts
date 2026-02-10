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
});
