/**
 * An HTTP answer a strategy or authorizer wants written **as-is**.
 *
 * Throw it from `McpAuthStrategy.authenticate` or `McpAuthorizer.authorize` to
 * end the request with any status the OAuth challenge helpers do not cover —
 * `429` with `Retry-After` for a rate-limited key, `403` with a custom JSON
 * body, `503` while a key store is unreachable.
 *
 * - `body` — a string is sent as `text/plain`; anything else is serialized as
 *   JSON; `undefined` sends no body.
 * - `headers` — added to the response (they win over a same-named default
 *   such as `content-type`).
 *
 * @example
 * ```typescript
 * throw new McpHttpError(429, { error: 'too_many_requests' }, { 'Retry-After': '30' });
 * ```
 */
export class McpHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super(`MCP authentication answered HTTP ${status}`);
    this.name = 'McpHttpError';
  }

  /** The web-standard `Response` this error describes. */
  toResponse(): Response {
    const headers = new Headers();
    let payload: string | null = null;

    if (typeof this.body === 'string') {
      headers.set('content-type', 'text/plain; charset=utf-8');
      payload = this.body;
    } else if (this.body !== undefined) {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(this.body);
    }

    for (const [name, value] of Object.entries(this.headers ?? {})) {
      headers.set(name, value);
    }

    return new Response(payload, { status: this.status, headers });
  }
}

/**
 * `403 { "error": "access_denied", "error_description": … }`.
 *
 * Throw it from an `McpAuthorizer` when the authenticated caller may not use
 * this endpoint at all and no re-consent could change that — for example they
 * are not a member of the workspace a header selects. For a grant that merely
 * lacks a consentable scope, throw
 * `new OAuthError(OAuthErrorCode.InsufficientScope, …)` instead, which answers
 * with a step-up `WWW-Authenticate` challenge.
 *
 * Deliberately **not** routed through the SDK's `bearerAuthChallengeResponse`,
 * which maps every code other than `invalid_token` / `insufficient_scope` to
 * `400`.
 */
export class McpAccessDeniedError extends McpHttpError {
  constructor(description = 'Access denied') {
    super(403, { error: 'access_denied', error_description: description });
    this.name = 'McpAccessDeniedError';
  }
}

/**
 * `401 { "error": "unauthorized", "error_description": … }` — protocol-neutral
 * "these credentials are mine, and they are not valid".
 *
 * Throw it from any `McpAuthStrategy` that is not OAuth (API key, Basic,
 * session cookie, mTLS…). The response carries `challenge` when given,
 * otherwise every challenge registered by the module's strategies. OAuth
 * strategies may keep throwing `OAuthError(OAuthErrorCode.InvalidToken)` to get
 * the Bearer `invalid_token` challenge.
 */
export class McpUnauthorizedError extends McpHttpError {
  constructor(
    description = 'Invalid credentials',
    readonly challenge?: string,
  ) {
    super(
      401,
      { error: 'unauthorized', error_description: description },
      challenge === undefined ? undefined : { 'WWW-Authenticate': challenge },
    );
    this.name = 'McpUnauthorizedError';
  }
}
