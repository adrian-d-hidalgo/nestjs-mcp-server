import { Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';

import {
  AuthenticatedRequest,
  AuthInfo,
  McpAuthStrategy,
  OAuthError,
  OAuthErrorCode,
} from '../../src';
import { ISSUER, JWT_SECRET, RESOURCE } from './auth.constants';

/**
 * JWT access token via `Authorization: Bearer`, verified with `jose`.
 *
 * Checking `audience` is this strategy's job (RFC 8707): a token minted for
 * another resource must not be accepted here.
 */
@Injectable()
export class JwtStrategy implements McpAuthStrategy {
  async authenticate(request: AuthenticatedRequest): Promise<AuthInfo | null> {
    // The auth-scheme is case-insensitive (RFC 9110 §11.1).
    const match = /^Bearer +(\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match) return null;
    const token = match[1];

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET, {
        issuer: ISSUER,
        audience: RESOURCE,
        // Without `exp` a leaked token would never stop working.
        requiredClaims: ['exp'],
      });

      return {
        token,
        clientId:
          [payload.client_id, payload.sub].find(
            (claim): claim is string => typeof claim === 'string',
          ) ?? 'unknown',
        scopes: (typeof payload.scope === 'string' ? payload.scope : '')
          .split(' ')
          .filter(Boolean),
        // Seconds since the epoch, like the JWT `exp` claim.
        expiresAt: payload.exp,
        extra: { method: 'jwt', sub: payload.sub },
      };
    } catch {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token');
    }
  }
}
