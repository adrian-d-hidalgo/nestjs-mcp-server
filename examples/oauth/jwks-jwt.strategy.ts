import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import {
  AuthenticatedRequest,
  AuthInfo,
  McpAuthStrategy,
  OAuthError,
  OAuthErrorCode,
} from '../../src';
import { OAUTH_EXAMPLE_CONFIG, OAuthExampleConfig } from './oauth.config';

/**
 * Bearer JWT access tokens verified against the authorization server's JWKS.
 *
 * Provider-agnostic: point `OAUTH_ISSUER`, `OAUTH_JWKS_URL` and `MCP_RESOURCE`
 * at the mock in this folder, Auth0, Okta, Keycloak or any AS that issues
 * JWT access tokens. It checks the signature (keys fetched and cached from the
 * JWKS, re-fetched on an unknown `kid`), the issuer, the expiry and — the part
 * that is easiest to forget — the audience: a token minted for another
 * resource must not be accepted here (RFC 8707).
 */
@Injectable()
export class JwksJwtStrategy implements McpAuthStrategy {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    @Inject(OAUTH_EXAMPLE_CONFIG) private readonly config: OAuthExampleConfig,
  ) {
    this.jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  }

  async authenticate(request: AuthenticatedRequest): Promise<AuthInfo | null> {
    // The auth-scheme is case-insensitive (RFC 9110 §11.1).
    const match = /^Bearer +(\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) return null;
    const token = match[1];

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.resource,
        requiredClaims: ['exp'],
      });

      // `scope` (RFC 9068, Auth0, Keycloak) or `scp` (Okta, Entra ID).
      const scopes =
        typeof payload.scope === 'string'
          ? payload.scope.split(' ').filter(Boolean)
          : Array.isArray(payload.scp)
            ? payload.scp.map(String)
            : [];

      return {
        token,
        // `client_id` (RFC 9068), else `azp` (OIDC-style providers), else `sub`.
        clientId:
          [payload.client_id, payload.azp, payload.sub].find(
            (claim): claim is string => typeof claim === 'string',
          ) ?? 'unknown',
        scopes,
        expiresAt: payload.exp, // seconds since the epoch
        resource: new URL(this.config.resource),
        extra: { sub: payload.sub },
      };
    } catch {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token');
    }
  }
}
