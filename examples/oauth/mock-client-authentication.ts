/**
 * Client authentication and redirect-URI policy of the MOCK OAuth 2.1
 * authorization server (`mock-authorization-server.ts`).
 *
 * DEMO ONLY — tests and demos, NEVER production: the confidential client's
 * secret is hard-coded and published (`demo-clients.ts`).
 */
import { UnauthorizedException } from '@nestjs/common';

import { DemoClient } from './demo-clients';
import { param, Params, safeEqual } from './mock-authorization-protocol';

/**
 * RFC 8252 §7.3 loopback redirect: plain `http` to `localhost` or
 * `127.0.0.1`, any port and path — native clients (MCP Inspector, Claude
 * Code) pick their callback port at run time.
 */
const isLoopbackRedirect = (uri: string): boolean => {
  try {
    const url = new URL(uri);
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
};

/** Credentials presented at the token endpoint (RFC 6749 §2.3.1). */
interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

/** Reads `Authorization: Basic`, then the form, for the client credentials. */
const readCredentials = (
  body: Params,
  authorization?: string,
): ClientCredentials => {
  const match = /^Basic\s+(\S+)$/i.exec(authorization ?? '');
  if (match) {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    try {
      // RFC 6749 §2.3.1: both parts are form-urlencoded before encoding.
      return {
        clientId: decodeURIComponent(decoded.slice(0, colon)),
        clientSecret: decodeURIComponent(decoded.slice(colon + 1)),
      };
    } catch {
      return {};
    }
  }
  return {
    clientId: param(body, 'client_id'),
    clientSecret: param(body, 'client_secret'),
  };
};

/**
 * RFC 6749 §5.2 `invalid_client`: 401 with a `WWW-Authenticate` challenge
 * (set by the controller, which owns the response).
 */
export class InvalidClientException extends UnauthorizedException {
  constructor(description: string) {
    super({ error: 'invalid_client', error_description: description });
  }
}

/** Whether `redirectUri` is acceptable for `client`. */
export const allowsRedirect = (
  client: DemoClient,
  redirectUri: string,
): boolean =>
  client.redirectUris
    ? client.redirectUris.includes(redirectUri)
    : isLoopbackRedirect(redirectUri);

/**
 * Authenticates the client at the token and revocation endpoints and
 * returns its ID. Public clients send only `client_id`; confidential ones
 * must present their secret.
 */
export const authenticateClient = (
  clients: ReadonlyMap<string, DemoClient>,
  body: Params,
  authorization?: string,
): string => {
  const { clientId, clientSecret } = readCredentials(body, authorization);
  const client = clientId ? clients.get(clientId) : undefined;
  if (!client) {
    throw new InvalidClientException('Unknown client');
  }
  if (client.clientSecret === undefined) {
    return client.clientId;
  }
  if (clientSecret === undefined) {
    throw new InvalidClientException('Client authentication is required');
  }
  if (!safeEqual(clientSecret, client.clientSecret)) {
    throw new InvalidClientException('Client authentication failed');
  }
  return client.clientId;
};
