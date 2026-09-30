import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';

import { McpProtectedResourceController } from './mcp-protected-resource.controller';

const request = (path: string): Request => ({ path }) as Request;

describe('McpProtectedResourceController', () => {
  it('serves the RFC 9728 document at the path derived from the resource', () => {
    const controller = new McpProtectedResourceController({
      strategies: [],
      protectedResource: {
        resource: 'https://example.com/mcp',
        authorizationServers: ['https://as.example.com'],
        scopesSupported: ['read'],
        resourceName: 'Example',
      },
    });

    expect(
      controller.getMetadata(
        request('/.well-known/oauth-protected-resource/mcp'),
      ),
    ).toEqual({
      resource: 'https://example.com/mcp',
      authorization_servers: ['https://as.example.com'],
      scopes_supported: ['read'],
      resource_name: 'Example',
    });
  });

  it('also answers the trailing-slash variant of the metadata path', () => {
    const controller = new McpProtectedResourceController({
      strategies: [],
      protectedResource: {
        resource: 'https://example.com/mcp',
        authorizationServers: ['https://as.example.com'],
      },
    });

    expect(
      controller.getMetadata(
        request('/.well-known/oauth-protected-resource/mcp/'),
      ),
    ).toEqual(expect.objectContaining({ resource: 'https://example.com/mcp' }));
  });

  it('omits optional fields that were not configured', () => {
    const controller = new McpProtectedResourceController({
      strategies: [],
      protectedResource: {
        resource: 'https://example.com/',
        authorizationServers: ['https://as.example.com'],
      },
    });

    expect(
      controller.getMetadata(request('/.well-known/oauth-protected-resource')),
    ).toEqual({
      resource: 'https://example.com/',
      authorization_servers: ['https://as.example.com'],
    });
  });

  it('answers 404 for the metadata path of another resource', () => {
    const controller = new McpProtectedResourceController({
      strategies: [],
      protectedResource: {
        resource: 'https://example.com/mcp',
        authorizationServers: [],
      },
    });

    expect(() =>
      controller.getMetadata(
        request('/.well-known/oauth-protected-resource/other'),
      ),
    ).toThrow(NotFoundException);
  });

  it('answers 404 when no protectedResource is configured', () => {
    const controller = new McpProtectedResourceController(undefined);

    expect(() =>
      controller.getMetadata(
        request('/.well-known/oauth-protected-resource/mcp'),
      ),
    ).toThrow(NotFoundException);
  });
});
