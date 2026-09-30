import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  AuthenticatedRequest,
  AuthInfo,
  McpAuthStrategy,
  McpUnauthorizedError,
} from '../../src';
import { API_KEYS } from './auth.constants';

/** Per-process key: the MACs below are only ever compared, never stored. */
const COMPARE_KEY = randomBytes(32);

const digest = (value: string): Buffer =>
  createHmac('sha256', COMPARE_KEY).update(value).digest();

/**
 * The scopes of a known key, or `undefined`.
 *
 * A `Map` rather than a plain-object lookup, so `toString` or `__proto__` is
 * never mistaken for a key; every stored key is compared in constant time
 * (over fixed-length digests), so response timing does not leak a prefix.
 */
function findScopes(presented: string): string[] | undefined {
  const candidate = digest(presented);
  let found: string[] | undefined;
  for (const [key, scopes] of API_KEYS) {
    if (timingSafeEqual(digest(key), candidate)) found = scopes;
  }
  return found;
}

/**
 * API key from a custom header — what Claude Code and Cursor send when
 * configured with static headers.
 *
 * `null` when the header is absent ("not mine, try the next strategy");
 * `McpUnauthorizedError` when it is present but unknown ("mine, and wrong").
 * Nothing here is OAuth: the `challenge` tells clients how to send the key.
 */
@Injectable()
export class ApiKeyStrategy implements McpAuthStrategy {
  readonly challenge = 'ApiKey header="x-api-key"';

  authenticate(request: AuthenticatedRequest): AuthInfo | null {
    const key = request.headers['x-api-key'];
    if (typeof key !== 'string') return null;

    const scopes = findScopes(key);
    if (!scopes) {
      throw new McpUnauthorizedError('Unknown API key');
    }

    return {
      token: key,
      // A short fingerprint, never part of the key: `clientId` is logged and
      // shown to handlers, so it must not narrow the secret down.
      clientId: `api-key:${digest(key).toString('hex').slice(0, 12)}`,
      scopes,
      extra: { method: 'api-key' },
    };
  }
}
