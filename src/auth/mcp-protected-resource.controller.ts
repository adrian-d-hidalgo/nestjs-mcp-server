import type { OAuthProtectedResourceMetadata } from '@modelcontextprotocol/server';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/server';
import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Optional,
  Req,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import type { Request } from 'express';

import { MCP_AUTH_OPTIONS } from '../mcp.constants';
import type { McpAuthOptions } from '../mcp.types';

/**
 * Serves the OAuth 2.0 Protected Resource Metadata document (RFC 9728) for the
 * MCP endpoint, built from `auth.protectedResource`.
 *
 * Answers only at the exact path `getOAuthProtectedResourceMetadataUrl`
 * derives from `resource` (path-aware, per RFC 9728 §3.1), with or without a
 * trailing slash as the SDK's `oauthMetadataResponse` accepts; every other
 * `/.well-known/oauth-protected-resource…` path is a `404`. The library does
 * not serve authorization-server metadata — that belongs to the AS.
 *
 * Registered by `forRoot` when `auth.protectedResource` is set, and by
 * `forRootAsync` when `protectedResourceMetadata: true`. `VERSION_NEUTRAL`
 * because RFC 9728 fixes the well-known path, whatever versioning the app uses.
 */
@Controller({ version: VERSION_NEUTRAL })
export class McpProtectedResourceController {
  private readonly path: string | undefined;
  private readonly metadata: OAuthProtectedResourceMetadata | undefined;

  constructor(
    @Optional()
    @Inject(MCP_AUTH_OPTIONS)
    options: McpAuthOptions | undefined,
  ) {
    const resource = options?.protectedResource;
    if (!resource) return;

    this.path = new URL(
      getOAuthProtectedResourceMetadataUrl(new URL(resource.resource)),
    ).pathname;
    this.metadata = {
      resource: resource.resource,
      authorization_servers: resource.authorizationServers,
      ...(resource.scopesSupported !== undefined
        ? { scopes_supported: resource.scopesSupported }
        : {}),
      ...(resource.resourceName !== undefined
        ? { resource_name: resource.resourceName }
        : {}),
    };
  }

  // Public metadata: browser-based MCP clients fetch it cross-origin.
  @Get('.well-known/oauth-protected-resource{/*path}')
  @Header('Access-Control-Allow-Origin', '*')
  getMetadata(@Req() req: Request): OAuthProtectedResourceMetadata {
    // Like the SDK's `oauthMetadataResponse`, a trailing slash is tolerated.
    const path =
      req.path.length > 1 && req.path.endsWith('/')
        ? req.path.slice(0, -1)
        : req.path;
    if (!this.metadata || path !== this.path) {
      throw new NotFoundException();
    }

    return this.metadata;
  }
}
