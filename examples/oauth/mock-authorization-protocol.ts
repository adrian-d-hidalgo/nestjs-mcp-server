/**
 * Shared protocol pieces of the MOCK OAuth 2.1 authorization server
 * (`mock-authorization-server.ts`): lifetimes, the in-memory record shapes and
 * small OAuth helpers.
 *
 * DEMO ONLY — tests and demos, NEVER production. See
 * `mock-authorization-server.ts` for what the mock does and does not do.
 */
import { BadRequestException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

import { DemoClient } from './demo-clients';

/** Access-token lifetime, in seconds. */
export const ACCESS_TOKEN_TTL = 600;
/** Authorization-code lifetime, in milliseconds. */
export const CODE_TTL_MS = 60_000;
/** How long a login/consent form stays valid, in milliseconds. */
export const PENDING_TTL_MS = 10 * 60_000;
/** SSO session lifetime, in seconds. */
export const SESSION_TTL = 10 * 60;
/** Name of the SSO session cookie. */
export const SESSION_COOKIE = 'mock_as_session';
/** Realm of the `WWW-Authenticate: Basic` challenge on `invalid_client`. */
export const TOKEN_REALM = 'mock-authorization-server';
/**
 * OIDC's refresh-token scope. Clients (the MCP Inspector's "request refresh
 * token" option) may ask for it; this server always issues refresh tokens,
 * so it is accepted and dropped, never granted.
 */
export const OFFLINE_ACCESS = 'offline_access';
export const CLIENT_AUTH_METHODS = [
  'none',
  'client_secret_basic',
  'client_secret_post',
];

export interface Grant {
  clientId: string;
  /** The user: the access token's `sub`. */
  subject: string;
  scope: string;
  resource: string;
}

export interface CodeGrant extends Grant {
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

/** A validated authorization request, waiting for login and consent. */
export interface PendingRequest {
  client: DemoClient;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  /** Requested ∩ client allowed (client allowed when none was requested). */
  scopes: string[];
  expiresAt: number;
  /** Set once the user is known: the session the consent is bound to. */
  sessionId?: string;
  username?: string;
  /** Set with the session: what the consent page offers. */
  granted?: string[];
}

export interface Session {
  username: string;
  expiresAt: number;
}

/** What the controller sends back for a browser-facing endpoint. */
export type Outcome = (
  { redirect: string } | { status: number; html: string; redirect?: undefined }
) & {
  /** A new SSO session to set as a cookie. */
  session?: string;
};

export type Params = Record<string, unknown>;

export const param = (params: Params, name: string): string | undefined =>
  typeof params[name] === 'string' ? params[name] : undefined;

export const oauthError = (
  error: string,
  description: string,
): BadRequestException =>
  new BadRequestException({ error, error_description: description });

export const sameUrl = (a: string | undefined, b: string): boolean => {
  try {
    return a !== undefined && new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
};

export const randomToken = (): string => randomBytes(32).toString('base64url');

/** Constant-time string comparison (hashing equalises the lengths). */
export const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );

export const intersect = (a: string[], b: string[]): string[] =>
  a.filter((item) => b.includes(item));
