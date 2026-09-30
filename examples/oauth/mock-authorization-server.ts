/**
 * A MOCK OAuth 2.1 authorization server, for tests and demos ONLY.
 *
 * NEVER use it in production: its users, passwords and client secret are
 * hard-coded and published (`demo-users.ts`, `demo-clients.ts`), it keeps
 * sessions, clients, codes and refresh tokens in memory, and it generates a
 * new signing key on every boot.
 *
 * It behaves like a hosted provider (Auth0, Okta, Keycloak) so the MCP
 * server's OAuth support can be exercised end to end in one process, without
 * Docker or a provider account:
 *
 * - RFC 8414 metadata and an RS256 JWKS;
 * - pre-registered clients: `notes-inspector` (public, PKCE only) and
 *   `notes-confidential` (`client_secret_basic` / `client_secret_post`), both
 *   with any loopback redirect URI (RFC 8252 §7.3);
 * - RFC 7591 dynamic client registration, OFF unless
 *   `OAUTH_DYNAMIC_REGISTRATION=true` (registered clients are public, with
 *   exact-match redirect URIs);
 * - the authorization code grant with PKCE (S256) and RFC 8707 resource
 *   indicators, behind a login page, a short-lived SSO session cookie and a
 *   consent page. The grant is `requested ∩ client allowed ∩ user allowed`;
 * - refresh-token rotation, and RFC 7009 revocation of refresh tokens. Access
 *   tokens are self-contained JWTs: revocation does not touch them, they stay
 *   valid until they expire (10 minutes), as with most JWT providers.
 *
 * Files: this service (the authorization logic), its controller
 * (`mock-authorization-server.controller.ts`), shared protocol pieces
 * (`mock-authorization-protocol.ts`), client authentication
 * (`mock-client-authentication.ts`) and the HTML pages
 * (`mock-authorization-pages.ts`).
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { exportJWK, generateKeyPair, JWK, SignJWT } from 'jose';

import { DEMO_CLIENTS, DemoClient } from './demo-clients';
import { DEMO_USERS, DemoUser } from './demo-users';
import { consentPage, errorPage, loginPage } from './mock-authorization-pages';
import {
  ACCESS_TOKEN_TTL,
  CLIENT_AUTH_METHODS,
  CODE_TTL_MS,
  CodeGrant,
  Grant,
  intersect,
  OFFLINE_ACCESS,
  oauthError,
  Outcome,
  param,
  Params,
  PENDING_TTL_MS,
  PendingRequest,
  randomToken,
  safeEqual,
  sameUrl,
  Session,
  SESSION_TTL,
} from './mock-authorization-protocol';
import {
  allowsRedirect,
  authenticateClient,
} from './mock-client-authentication';
import {
  OAUTH_EXAMPLE_CONFIG,
  OAuthExampleConfig,
  SCOPES,
} from './oauth.config';

@Injectable()
export class MockAuthorizationServer implements OnModuleInit {
  private privateKey!: CryptoKey;
  private jwk!: JWK;
  private readonly clients = new Map<string, DemoClient>(
    DEMO_CLIENTS.map((client) => [client.clientId, client]),
  );
  private readonly pending = new Map<string, PendingRequest>();
  private readonly sessions = new Map<string, Session>();
  private readonly codes = new Map<string, CodeGrant>();
  private readonly refreshTokens = new Map<string, Grant>();

  constructor(
    @Inject(OAUTH_EXAMPLE_CONFIG) private readonly config: OAuthExampleConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    this.privateKey = privateKey;
    this.jwk = {
      ...(await exportJWK(publicKey)),
      kid: randomUUID(),
      alg: 'RS256',
      use: 'sig',
    };
  }

  get jwks(): { keys: JWK[] } {
    return { keys: [this.jwk] };
  }

  /** Whether the session cookie can be marked `Secure`. */
  get secureCookies(): boolean {
    return this.config.issuer.startsWith('https:');
  }

  /** RFC 8414 Authorization Server Metadata. */
  get metadata(): Record<string, unknown> {
    const { issuer } = this.config;
    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      revocation_endpoint: `${issuer}/revoke`,
      ...(this.config.dynamicRegistration
        ? { registration_endpoint: `${issuer}/register` }
        : {}),
      jwks_uri: `${issuer}/jwks`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: CLIENT_AUTH_METHODS,
      revocation_endpoint_auth_methods_supported: CLIENT_AUTH_METHODS,
      scopes_supported: SCOPES,
      authorization_response_iss_parameter_supported: true,
    };
  }

  /**
   * RFC 7591 dynamic registration, when enabled: a PUBLIC client that may
   * request every scope in {@link SCOPES}, with exact-match redirect URIs.
   */
  register(metadata: Params): Params {
    if (!this.config.dynamicRegistration) {
      throw new ForbiddenException({
        error: 'access_denied',
        error_description:
          'Dynamic client registration is disabled; use a pre-registered client_id',
      });
    }
    const uris = metadata.redirect_uris;
    if (
      !Array.isArray(uris) ||
      uris.length === 0 ||
      !uris.every((uri) => typeof uri === 'string')
    ) {
      throw oauthError('invalid_client_metadata', 'redirect_uris is required');
    }

    const clientName = param(metadata, 'client_name') ?? 'Unnamed client';
    const clientId = randomUUID();
    this.clients.set(clientId, {
      clientId,
      clientName,
      scopes: SCOPES,
      redirectUris: uris,
    });
    return {
      ...metadata,
      client_id: clientId,
      client_name: clientName,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: 'none',
    };
  }

  /**
   * GET /authorize. Validates the request, then shows the login page — or,
   * with a live session cookie, goes straight to the consent page.
   *
   * An unknown client or redirect URI gets an error page, never a redirect
   * (RFC 6749 §4.1.2.1); every other error is redirected to the client.
   */
  authorize(query: Params, sessionId?: string): Outcome {
    this.prune();
    const client = this.clients.get(param(query, 'client_id') ?? '');
    const redirectUri = param(query, 'redirect_uri') ?? '';
    if (!client) {
      return this.errorPage('invalid_request', 'Unknown client_id');
    }
    if (!allowsRedirect(client, redirectUri)) {
      return this.errorPage(
        'invalid_request',
        'redirect_uri is not registered for this client',
      );
    }

    const state = param(query, 'state');
    const fail = (error: string, description: string): Outcome =>
      this.redirectBack(redirectUri, state, {
        error,
        error_description: description,
      });

    const codeChallenge = param(query, 'code_challenge');
    const requested = (param(query, 'scope') ?? '')
      .split(' ')
      .filter((scope) => scope && scope !== OFFLINE_ACCESS);
    const unknown = requested.filter((scope) => !SCOPES.includes(scope));

    if (param(query, 'response_type') !== 'code') {
      return fail('unsupported_response_type', 'Only "code" is supported');
    }
    if (!codeChallenge || param(query, 'code_challenge_method') !== 'S256') {
      return fail('invalid_request', 'PKCE with S256 is required');
    }
    if (!sameUrl(param(query, 'resource'), this.config.resource)) {
      return fail('invalid_target', `resource must be ${this.config.resource}`);
    }
    if (unknown.length > 0) {
      return fail(
        'invalid_scope',
        `Unknown scope ${unknown.join(' ')}; supported: ${SCOPES.join(' ')}`,
      );
    }
    const scopes = requested.length
      ? intersect(requested, client.scopes)
      : client.scopes;
    if (scopes.length === 0) {
      return fail(
        'invalid_scope',
        `Allowed scopes for this client: ${client.scopes.join(' ')}`,
      );
    }

    const requestId = randomToken();
    const pending: PendingRequest = {
      client,
      redirectUri,
      state,
      codeChallenge,
      scopes,
      expiresAt: Date.now() + PENDING_TTL_MS,
    };
    this.pending.set(requestId, pending);

    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (sessionId && session && session.expiresAt > Date.now()) {
      return this.consentStep(requestId, pending, sessionId, session.username);
    }
    return {
      status: 200,
      html: loginPage({ requestId, clientName: client.clientName }),
    };
  }

  /**
   * POST /login. Wrong credentials re-render the login page (the pending
   * request stays usable); the right ones start a new session and move on to
   * consent.
   */
  login(body: Params): Outcome {
    const requestId = param(body, 'request') ?? '';
    const pending = this.pending.get(requestId);
    if (!pending || pending.expiresAt < Date.now() || pending.sessionId) {
      return this.staleForm();
    }

    const username = param(body, 'username') ?? '';
    const user = this.checkPassword(username, param(body, 'password') ?? '');
    if (!user) {
      return {
        status: 401,
        html: loginPage({
          requestId,
          clientName: pending.client.clientName,
          username,
          error: 'Invalid username or password',
        }),
      };
    }

    // Always a fresh session ID after authenticating (no session fixation).
    const sessionId = randomToken();
    this.sessions.set(sessionId, {
      username: user.username,
      expiresAt: Date.now() + SESSION_TTL * 1000,
    });
    return {
      ...this.consentStep(requestId, pending, sessionId, user.username),
      session: sessionId,
    };
  }

  /**
   * POST /consent. The pending request is single-use and must come from the
   * browser session it was shown to.
   */
  consent(body: Params, sessionId?: string): Outcome {
    const requestId = param(body, 'request') ?? '';
    const pending = this.pending.get(requestId);
    this.pending.delete(requestId);
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (
      !pending?.granted ||
      !pending.username ||
      pending.expiresAt < Date.now() ||
      !session ||
      session.expiresAt < Date.now() ||
      pending.sessionId !== sessionId
    ) {
      return this.staleForm();
    }

    const { redirectUri, state } = pending;
    switch (param(body, 'decision')) {
      case 'approve': {
        const code = randomToken();
        this.codes.set(code, {
          clientId: pending.client.clientId,
          subject: pending.username,
          redirectUri,
          codeChallenge: pending.codeChallenge,
          scope: pending.granted.join(' '),
          resource: this.config.resource,
          expiresAt: Date.now() + CODE_TTL_MS,
        });
        return this.redirectBack(redirectUri, state, { code });
      }
      case 'deny':
        return this.redirectBack(redirectUri, state, {
          error: 'access_denied',
          error_description: 'The user denied the request',
        });
      default:
        return this.errorPage('invalid_request', 'Missing consent decision');
    }
  }

  /**
   * The token endpoint: authorization_code (PKCE) and refresh_token. The
   * client is authenticated first, so the confidential client needs its
   * secret for both grants.
   */
  async token(body: Params, authorization?: string): Promise<Params> {
    const clientId = authenticateClient(this.clients, body, authorization);
    const resource = param(body, 'resource');
    let grant: Grant | undefined;

    switch (param(body, 'grant_type')) {
      case 'authorization_code': {
        const code = param(body, 'code') ?? '';
        const stored = this.codes.get(code);
        this.codes.delete(code); // single use, even when the exchange fails
        const verifier = param(body, 'code_verifier') ?? '';
        const challenge = createHash('sha256').update(verifier).digest();
        if (
          !stored ||
          stored.expiresAt < Date.now() ||
          stored.clientId !== clientId ||
          stored.redirectUri !== param(body, 'redirect_uri') ||
          challenge.toString('base64url') !== stored.codeChallenge
        ) {
          throw oauthError('invalid_grant', 'Invalid authorization code');
        }
        grant = stored;
        break;
      }
      case 'refresh_token': {
        const token = param(body, 'refresh_token') ?? '';
        grant = this.refreshTokens.get(token);
        if (!grant || grant.clientId !== clientId) {
          throw oauthError('invalid_grant', 'Invalid refresh token');
        }
        this.refreshTokens.delete(token); // rotation: every token works once
        break;
      }
      default:
        throw oauthError('unsupported_grant_type', 'Unsupported grant_type');
    }

    if (resource !== undefined && !sameUrl(resource, grant.resource)) {
      throw oauthError('invalid_target', 'resource does not match the grant');
    }

    const { subject, scope } = grant;
    const refreshToken = randomToken();
    this.refreshTokens.set(refreshToken, {
      clientId,
      subject,
      scope,
      resource: grant.resource,
    });

    return {
      access_token: await this.issueAccessToken({
        audience: grant.resource,
        clientId,
        subject,
        scope,
      }),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL,
      scope,
      refresh_token: refreshToken,
    };
  }

  /**
   * RFC 7009 revocation. Revokes refresh tokens issued to the authenticated
   * client; anything else (an unknown token, another client's token, an
   * access token) is answered 200 and left alone, as §2.2 allows. Access
   * tokens are self-contained JWTs and stay valid until they expire.
   */
  revoke(body: Params, authorization?: string): void {
    const clientId = authenticateClient(this.clients, body, authorization);
    const token = param(body, 'token');
    if (!token) throw oauthError('invalid_request', 'token is required');
    if (this.refreshTokens.get(token)?.clientId === clientId) {
      this.refreshTokens.delete(token);
    }
  }

  /**
   * Signs an RS256 JWT access token (RFC 9068 shape). Public so tests can
   * mint edge cases: another audience, a negative `ttlSeconds`.
   */
  issueAccessToken(claims: {
    audience: string;
    clientId: string;
    subject: string;
    scope: string;
    ttlSeconds?: number;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ scope: claims.scope, client_id: claims.clientId })
      .setProtectedHeader({ alg: 'RS256', kid: this.jwk.kid, typ: 'at+jwt' })
      .setIssuer(this.config.issuer)
      .setSubject(claims.subject)
      .setAudience(claims.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + (claims.ttlSeconds ?? ACCESS_TOKEN_TTL))
      .setJti(randomUUID())
      .sign(this.privateKey);
  }

  /**
   * The user is known: grant `requested ∩ client ∩ user` and show consent,
   * or send `invalid_scope` back when that is empty.
   */
  private consentStep(
    requestId: string,
    pending: PendingRequest,
    sessionId: string,
    username: string,
  ): Outcome {
    const userScopes =
      DEMO_USERS.find((user) => user.username === username)?.scopes ?? [];
    const granted = intersect(pending.scopes, userScopes);
    if (granted.length === 0) {
      this.pending.delete(requestId);
      const allowed = intersect(pending.client.scopes, userScopes);
      return this.redirectBack(pending.redirectUri, pending.state, {
        error: 'invalid_scope',
        error_description: `Allowed scopes for ${username} with this client: ${
          allowed.join(' ') || '(none)'
        }`,
      });
    }

    pending.sessionId = sessionId;
    pending.username = username;
    pending.granted = granted;
    return {
      status: 200,
      html: consentPage({
        requestId,
        clientName: pending.client.clientName,
        username,
        scopes: granted,
      }),
    };
  }

  private checkPassword(
    username: string,
    password: string,
  ): DemoUser | undefined {
    const user = DEMO_USERS.find(
      (candidate) => candidate.username === username,
    );
    // Compare even for an unknown user, so both failures take as long.
    const ok = safeEqual(password, user?.password ?? randomToken());
    return ok ? user : undefined;
  }

  /** The authorization response: `params`, `state` and `iss` (RFC 9207). */
  private redirectBack(
    redirectUri: string,
    state: string | undefined,
    params: Record<string, string>,
  ): Outcome {
    const redirect = new URL(redirectUri);
    for (const [name, value] of Object.entries(params)) {
      redirect.searchParams.set(name, value);
    }
    if (state !== undefined) redirect.searchParams.set('state', state);
    redirect.searchParams.set('iss', this.config.issuer);
    return { redirect: redirect.href };
  }

  private errorPage(error: string, description: string): Outcome {
    return { status: 400, html: errorPage(error, description) };
  }

  private staleForm(): Outcome {
    return this.errorPage(
      'invalid_request',
      'This sign-in request is unknown, already used or expired',
    );
  }

  /** Drops expired pending requests, sessions and codes. */
  private prune(): void {
    const now = Date.now();
    for (const map of [this.pending, this.sessions, this.codes]) {
      for (const [key, { expiresAt }] of map) {
        if (expiresAt < now) map.delete(key);
      }
    }
  }
}
