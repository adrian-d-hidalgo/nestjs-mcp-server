import type { AuthInfo } from '@modelcontextprotocol/server';
import {
  bearerAuthChallengeResponse,
  getOAuthProtectedResourceMetadataUrl,
  OAuthError,
  OAuthErrorCode,
} from '@modelcontextprotocol/server';
import {
  Inject,
  Injectable,
  OnModuleInit,
  Optional,
  Type,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Response as ExpressResponse } from 'express';

import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';
import { MCP_AUTH_OPTIONS } from '../mcp.constants';
import type { McpAuthOptions } from '../mcp.types';
import {
  assertScopeTokens,
  markPublicOnly,
} from '../services/capability-scopes';
import { DiscoveryService } from '../services/discovery.service';
import { McpLoggerService } from '../services/logger.service';
import { McpHttpError, McpUnauthorizedError } from './auth.errors';
import type { McpAuthStrategy } from './auth-strategy.interface';
import type { McpAuthorizer } from './authorizer.interface';
import {
  buildPublicIndex,
  isPublicRequest,
  type PublicCapabilityIndex,
} from './public-access';

/**
 * Escapes a value for an HTTP quoted-string (RFC 9110 §5.6.4).
 *
 * Ours because the SDK builds its own `WWW-Authenticate` values internally
 * and exports no quoting helper. Control characters other than HTAB cannot
 * appear in a quoted-string even escaped, so they are refused, not escaped.
 */
const quoted = (value: string): string => {
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0a-\x1f\x7f]/.test(value)) {
    throw new TypeError('An HTTP quoted-string cannot hold control characters');
  }
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
};

/**
 * One RFC 9110 §11.3 challenge: `auth-scheme [ 1*SP ( token68 / #auth-param ) ]`.
 * Used to refuse a malformed strategy `challenge` at boot rather than emit a
 * broken (or header-injecting) `WWW-Authenticate` on the first `401`.
 */
const TOKEN = "[!#$%&'*+.^_`|~0-9A-Za-z-]+";
const QUOTED_STRING =
  '"(?:[\\t !#-\\[\\]-~\\x80-\\xff]|\\\\[\\t -~\\x80-\\xff])*"';
const AUTH_PARAM = `${TOKEN}[ \\t]*=[ \\t]*(?:${TOKEN}|${QUOTED_STRING})`;
const CHALLENGE = new RegExp(
  `^${TOKEN}(?: +(?:[A-Za-z0-9._~+/-]+=*|${AUTH_PARAM}(?:[ \\t]*,[ \\t]*${AUTH_PARAM})*))?$`,
);

/**
 * Above this, an `expiresAt` is milliseconds, not seconds: `1e11` seconds is
 * past the year 5000, while `Date.now()` has exceeded `1e11` since 1973.
 */
const MAX_EXPIRES_AT_SECONDS = 1e11;

/**
 * Checks the shape of an `AuthInfo` returned by a strategy or an authorizer.
 * A wrong shape (including an `expiresAt` in milliseconds) is a programming
 * error in that class, answered `500` like any unexpected throw; an
 * `expiresAt` (seconds) already past is a credential problem, answered `401
 * invalid_token` as the SDK's `verifyBearerToken` does.
 */
function assertAuthInfo(
  auth: unknown,
  source: string,
): asserts auth is AuthInfo {
  const candidate = auth as Partial<AuthInfo> | null;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.token !== 'string' ||
    typeof candidate.clientId !== 'string' ||
    !Array.isArray(candidate.scopes) ||
    !candidate.scopes.every((scope) => typeof scope === 'string') ||
    (candidate.expiresAt !== undefined &&
      (typeof candidate.expiresAt !== 'number' ||
        Number.isNaN(candidate.expiresAt) ||
        candidate.expiresAt > MAX_EXPIRES_AT_SECONDS))
  ) {
    throw new TypeError(
      `${source} must return an AuthInfo with a string token, a string clientId, a scopes array of strings and an optional numeric expiresAt (seconds, not milliseconds)`,
    );
  }
  if (
    candidate.expiresAt !== undefined &&
    candidate.expiresAt < Date.now() / 1000
  ) {
    throw new OAuthError(OAuthErrorCode.InvalidToken, 'Token has expired');
  }
}

/**
 * Layer 1 (authentication) and Layer 2a (request authorization) of the MCP
 * endpoint, run once per HTTP request before the SDK sees it.
 *
 * Inert when `McpModuleOptions.auth` is absent: {@link enabled} is `false` and
 * the endpoint behaves exactly as without this service.
 */
@Injectable()
export class McpAuthService implements OnModuleInit {
  private strategies: McpAuthStrategy[] = [];
  private authorizers: McpAuthorizer[] = [];
  private resourceMetadataUrl: string | undefined;
  private strategyChallenges: string[] = [];
  /** The `WWW-Authenticate` value, built (and validated) once at boot. */
  private challenge = 'Bearer';
  /** Every `public` capability; undefined when none is (no body inspection). */
  private publicIndex: PublicCapabilityIndex | undefined;

  constructor(
    @Optional()
    @Inject(MCP_AUTH_OPTIONS)
    private readonly options: McpAuthOptions | undefined,
    private readonly moduleRef: ModuleRef,
    private readonly logger: McpLoggerService,
    @Optional()
    private readonly discovery?: DiscoveryService,
  ) {}

  /** Whether an `auth` option was configured. */
  get enabled(): boolean {
    return this.options !== undefined;
  }

  /**
   * Resolves every strategy and authorizer from the container, and fails the
   * boot when one cannot be resolved. Never `new`: a class built outside DI has
   * `undefined` dependencies and could answer truthy — a fail-open.
   */
  onModuleInit(): void {
    if (!this.options) return;

    this.strategies = this.options.strategies.map((Strategy) =>
      this.resolve(Strategy, 'strategy'),
    );
    this.authorizers = (this.options.authorizers ?? []).map((Authorizer) =>
      this.resolve(Authorizer, 'authorizer'),
    );
    this.strategyChallenges = this.strategies
      .filter((strategy) => strategy.challenge !== undefined)
      .map((strategy) => {
        const { challenge } = strategy;
        if (typeof challenge !== 'string' || !CHALLENGE.test(challenge)) {
          throw new TypeError(
            `${strategy.constructor.name}.challenge must be one RFC 9110 challenge, e.g. 'ApiKey header="x-api-key"'; got ${JSON.stringify(challenge)}`,
          );
        }
        return challenge;
      });

    const scopesSupported = this.options.protectedResource?.scopesSupported;
    if (scopesSupported?.length) {
      assertScopeTokens(
        scopesSupported,
        'auth.protectedResource.scopesSupported',
      );
    }

    const resource = this.options.protectedResource?.resource;
    this.resourceMetadataUrl =
      resource === undefined
        ? undefined
        : getOAuthProtectedResourceMetadataUrl(new URL(resource));
    this.challenge = this.challengeHeader();

    // Providers are instantiated before any `onModuleInit`, so every resolver
    // is discoverable here; the capability set is fixed after boot.
    this.publicIndex = this.discovery
      ? buildPublicIndex(this.discovery)
      : undefined;

    this.logger.log(
      `MCP authentication enabled with ${this.strategies.length} strateg${this.strategies.length === 1 ? 'y' : 'ies'} and ${this.authorizers.length} authorizer(s)`,
      'auth',
    );
  }

  /**
   * Authenticates and authorizes one HTTP request.
   *
   * Resolves `true` when the request may proceed (with `req.auth` set to the
   * effective `AuthInfo`, or left undefined for an anonymous request under
   * `optional: true` or one admitted for `public` capabilities only), and
   * `false` when a response has already been written.
   */
  async authenticate(
    req: AuthenticatedRequest,
    res: ExpressResponse,
  ): Promise<boolean> {
    if (!this.options) return true;

    // CORS preflight carries no credentials by design; refusing it would stop
    // browser-based clients from ever sending the authenticated request.
    if (req.method === 'OPTIONS') return true;

    try {
      let auth: AuthInfo | null = null;

      for (const strategy of this.strategies) {
        auth = await strategy.authenticate(req);
        if (auth === null || auth === undefined) continue;
        assertAuthInfo(auth, `${strategy.constructor.name}.authenticate`);
        break;
      }

      if (!auth) {
        // Anonymous: nothing set upstream may pass for an identity no strategy
        // accepted.
        if (this.options.optional) {
          delete req.auth;
          return true;
        }
        if (this.publicIndex && isPublicRequest(req.body, this.publicIndex)) {
          // Admitted for public capabilities only.
          delete req.auth;
          markPublicOnly(req);
          return true;
        }
        await this.sendWebResponse(res, this.missingCredentialsResponse());
        return false;
      }

      for (const authorizer of this.authorizers) {
        const authorized: unknown = await authorizer.authorize(req, auth);
        assertAuthInfo(authorized, `${authorizer.constructor.name}.authorize`);
        auth = authorized;
      }

      req.auth =
        auth.resourceMetadataUrl === undefined &&
        this.resourceMetadataUrl !== undefined
          ? { ...auth, resourceMetadataUrl: this.resourceMetadataUrl }
          : auth;

      return true;
    } catch (error) {
      await this.sendWebResponse(res, this.errorResponse(error));
      return false;
    }
  }

  private resolve<T>(Class: Type<T>, kind: string): T {
    try {
      return this.moduleRef.get<T>(Class, { strict: false });
    } catch {
      throw new Error(
        `MCP auth ${kind} ${Class?.name ?? String(Class)} could not be resolved from the container. Register it as a provider.`,
      );
    }
  }

  /**
   * `401` for a request no strategy recognized.
   *
   * Built here rather than by the SDK helper because RFC 6750 §3.1 says a
   * request that carried no credentials SHOULD NOT get an error code, and the
   * helper always emits one.
   */
  private missingCredentialsResponse(): Response {
    return Response.json(
      { error_description: 'Authentication required' },
      { status: 401, headers: { 'WWW-Authenticate': this.challenge } },
    );
  }

  /**
   * Every way this endpoint accepts credentials, as one `WWW-Authenticate`
   * value (RFC 9110 allows a comma-separated list of challenges).
   *
   * The Bearer challenge comes first when OAuth discovery is configured
   * (`auth.protectedResource`), because MCP clients look for it; then each
   * strategy's own `challenge`. With neither, a bare `Bearer` keeps the header
   * present, as RFC 9110 requires on a `401`. Called once, at boot.
   */
  private challengeHeader(): string {
    const challenges: string[] = [];

    if (this.options?.protectedResource) {
      const params: string[] = [];
      const scopes = this.options.protectedResource.scopesSupported;
      if (scopes?.length) params.push(`scope=${quoted(scopes.join(' '))}`);
      if (this.resourceMetadataUrl) {
        params.push(`resource_metadata=${quoted(this.resourceMetadataUrl)}`);
      }
      challenges.push(params.length ? `Bearer ${params.join(', ')}` : 'Bearer');
    }

    challenges.push(...this.strategyChallenges);

    return challenges.length ? challenges.join(', ') : 'Bearer';
  }

  /**
   * Maps a strategy or authorizer failure to its HTTP answer:
   *
   * - `McpUnauthorizedError` without its own challenge — `401` with every
   *   challenge the module's strategies declare.
   * - `McpHttpError` (including `McpAccessDeniedError`) — written as-is.
   * - `OAuthError` — the SDK's `bearerAuthChallengeResponse`: `401` +
   *   challenge for `invalid_token`, `403` + challenge for
   *   `insufficient_scope`, `500` for `server_error`, `400` otherwise.
   * - anything else — `500`, logged by class and message only (never the
   *   request's headers or token).
   */
  private errorResponse(error: unknown): Response {
    if (error instanceof McpUnauthorizedError && !error.challenge) {
      const response = error.toResponse();
      response.headers.set('WWW-Authenticate', this.challenge);
      return response;
    }

    if (error instanceof McpHttpError) return error.toResponse();

    if (error instanceof OAuthError) {
      return bearerAuthChallengeResponse(error, {
        resourceMetadataUrl: this.resourceMetadataUrl,
      });
    }

    const name = error instanceof Error ? error.name : typeof error;
    const message = error instanceof Error ? error.message : '';
    this.logger.error(
      `MCP authentication failed unexpectedly: ${name}: ${message}`,
      undefined,
      'auth',
    );

    return bearerAuthChallengeResponse(error);
  }

  /**
   * Writes a web-standard `Response` onto the Express response.
   *
   * Hand-written: `@modelcontextprotocol/node` exports only `toNodeHandler`
   * and `toWebRequest`. `writeHead` merges with headers already set on `res`
   * (helmet, CORS), so those survive.
   */
  private async sendWebResponse(
    res: ExpressResponse,
    response: Response,
  ): Promise<void> {
    if (res.headersSent) return;

    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    const body = await response.text();

    res.writeHead(response.status, headers);
    res.end(body);
  }
}
