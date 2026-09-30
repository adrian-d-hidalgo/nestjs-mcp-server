/** Injection token for {@link OAuthExampleConfig}. */
export const OAUTH_EXAMPLE_CONFIG = Symbol('OAUTH_EXAMPLE_CONFIG');

/** Path prefix the mock authorization server is mounted under. */
export const MOCK_AS_PREFIX = 'oauth';

/** Scopes this MCP server understands. */
export const SCOPES = ['notes:read', 'notes:write'];

export interface OAuthExampleConfig {
  /** Canonical URL of the MCP endpoint: the RFC 8707 audience of its tokens. */
  resource: string;
  /** Issuer of accepted access tokens (the `iss` claim). */
  issuer: string;
  /** Where the issuer publishes its signing keys. */
  jwksUrl: string;
  /** Whether to mount the in-process mock authorization server. */
  mockAuthorizationServer: boolean;
  /**
   * Whether the mock authorization server accepts RFC 7591 dynamic client
   * registration (`OAUTH_DYNAMIC_REGISTRATION=true`). Off by default, as on
   * most hosted providers: clients use a pre-registered `client_id`.
   */
  dynamicRegistration: boolean;
  /**
   * DEMO: tools the app's own guard always refuses, whatever the token's
   * scopes (`OAUTH_FORCE_UNAUTHORIZED`). Wins over {@link forceAuthorized}.
   */
  forceUnauthorized: string[];
  /**
   * DEMO: tools that require no scope at all — any authenticated caller may
   * call them (`OAUTH_FORCE_AUTHORIZED`). Applied when the resolver class is
   * built, i.e. at boot.
   */
  forceAuthorized: string[];
}

/** Whether `url` points at this machine. */
const isLoopback = (url: string): boolean =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);

/** Parses a comma-separated list of tool names; blanks are dropped. */
const toolList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

/**
 * Builds the example's configuration for a server reachable at `baseUrl`.
 *
 * With no environment variables, tokens come from the mock authorization
 * server mounted at `<baseUrl>/oauth`. Set `OAUTH_ISSUER` (and usually
 * `OAUTH_JWKS_URL` and `MCP_RESOURCE`) to trust a real provider instead; the
 * mock is then not mounted. The mock is a demo: without `OAUTH_ISSUER` this
 * throws — failing the boot — when `NODE_ENV` is `production` or when
 * `baseUrl` (`BASE_URL`) or `MCP_RESOURCE` is not a loopback URL.
 *
 * `OAUTH_DYNAMIC_REGISTRATION=true` lets clients register themselves with the
 * mock (RFC 7591); by default only the pre-registered clients exist.
 *
 * `OAUTH_FORCE_UNAUTHORIZED` and `OAUTH_FORCE_AUTHORIZED` (comma-separated
 * tool names) force authorization outcomes for demos; both are read once, at
 * boot.
 */
export const resolveOAuthConfig = (
  baseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): OAuthExampleConfig => {
  const issuer = env.OAUTH_ISSUER ?? `${baseUrl}/${MOCK_AS_PREFIX}`;
  const resource = env.MCP_RESOURCE ?? `${baseUrl}/mcp`;
  const mockAuthorizationServer = env.OAUTH_ISSUER === undefined;

  if (
    mockAuthorizationServer &&
    (env.NODE_ENV === 'production' ||
      !isLoopback(baseUrl) ||
      !isLoopback(resource))
  ) {
    throw new Error(
      `examples/oauth: refusing to mount the demo mock authorization server (hard-coded users, keys generated in memory) outside a local run — NODE_ENV=${env.NODE_ENV ?? '(unset)'}, BASE_URL=${baseUrl}, MCP_RESOURCE=${resource}. Set OAUTH_ISSUER (and OAUTH_JWKS_URL) to trust a real authorization server.`,
    );
  }

  return {
    resource,
    issuer,
    jwksUrl: env.OAUTH_JWKS_URL ?? `${issuer}/jwks`,
    mockAuthorizationServer,
    dynamicRegistration: env.OAUTH_DYNAMIC_REGISTRATION === 'true',
    forceUnauthorized: toolList(env.OAUTH_FORCE_UNAUTHORIZED),
    forceAuthorized: toolList(env.OAUTH_FORCE_AUTHORIZED),
  };
};
