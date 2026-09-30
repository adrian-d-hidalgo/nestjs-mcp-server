import type {
  AuthInfo,
  ScopeChallengeHandler,
} from '@modelcontextprotocol/server';
import { requireScopes } from '@modelcontextprotocol/server';

import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';
import type { McpRegistrationContext } from '../interfaces/registration-context.interface';
import { MCP_RESOLVER_OPTIONS } from '../mcp.constants';
import type { McpAuthOptions } from '../mcp.types';
import {
  disableCapability,
  type McpCapabilityHandle,
} from './capability-gates';
import type { McpLoggerService } from './logger.service';

/**
 * Internal to `RegistryService`: per-capability required scopes. Not part of
 * the public API — nothing here is re-exported from the package entry.
 */

/** A capability's required scopes, as declared on its decorator. */
type RequiredScopes = [string, ...string[]];

/**
 * Asserts every entry satisfies the OAuth `scope-token` grammar (RFC 6749
 * §3.3: printable ASCII except space, `"` and `\\`) and that the list is not
 * empty, failing with `location` in the message.
 *
 * Reuses the SDK's own check through `requireScopes`, which validates its
 * arguments eagerly; the SDK does not export the validator itself.
 */
export function assertScopeTokens(scopes: unknown, location: string): void {
  try {
    if (!Array.isArray(scopes)) throw new TypeError('must be an array');
    requireScopes(...(scopes as RequiredScopes));
  } catch (error) {
    throw new TypeError(
      `${location} must be a non-empty array of OAuth scope-tokens (no spaces, quotes, backslashes or control characters): ${(error as Error).message}`,
      { cause: error },
    );
  }
}

/**
 * Validates the access options a decorator declares: every `scopes` entry is a
 * scope-token, and `public: true` is not combined with `scopes`.
 *
 * The combination is refused rather than resolved because it has no single
 * reading: "anyone may call it" and "only a grant holding X may call it"
 * contradict each other, and silently picking one would either expose a
 * capability its author meant to protect or protect one they meant to open.
 */
export function assertCapabilityAccess(
  options: { scopes?: unknown; public?: boolean },
  location: string,
): void {
  if (options.scopes !== undefined) {
    assertScopeTokens(options.scopes, `${location} scopes`);
  }
  if (options.public === true && options.scopes !== undefined) {
    throw new TypeError(
      `${location}: a public capability cannot declare scopes. Remove one: public: true lets anonymous callers in, scopes restrict it to a grant.`,
    );
  }
}

/** The access options a capability or resolver may declare. */
interface AccessOptions {
  scopes?: RequiredScopes;
  public?: boolean;
  hideOutOfScope?: boolean;
}

/** A capability's effective access, after resolver defaults are applied. */
export interface CapabilityAccess {
  scopes?: RequiredScopes;
  isPublic: boolean;
  /** Undefined when neither the capability nor its resolver declares one. */
  hideOutOfScope?: boolean;
}

/**
 * Merges a capability's own access options over its resolver's defaults
 * (`@Resolver({ scopes, public, hideOutOfScope })`).
 *
 * - `public`: the capability's own value; otherwise the resolver's, unless the
 *   capability declares its own `scopes` (a scoped capability is protected).
 * - `scopes`: none when public; otherwise the capability's, which **replace**
 *   the resolver's.
 * - `hideOutOfScope`: the capability's, then the resolver's; the module's
 *   `auth.hideOutOfScope` applies when both are undefined.
 *
 * A resolver declared with the string form has no defaults, so the result is
 * exactly the capability's own options.
 */
export function resolveCapabilityAccess(
  metadata: AccessOptions,
  resolverClass: object,
): CapabilityAccess {
  const defaults = (Reflect.getMetadata(MCP_RESOLVER_OPTIONS, resolverClass) ??
    {}) as AccessOptions;

  const isPublic =
    metadata.public ??
    (metadata.scopes === undefined && defaults.public === true);

  return {
    scopes: isPublic ? undefined : (metadata.scopes ?? defaults.scopes),
    isPublic,
    hideOutOfScope: metadata.hideOutOfScope ?? defaults.hideOutOfScope,
  };
}

/**
 * Whether `authInfo` satisfies `scopes`, or `undefined` when that cannot be
 * decided — a grant without a `scopes` array, or an `auth.scopeSatisfies`
 * that threw. Callers treat `undefined` as "no" (fail closed).
 */
function grantSatisfies(
  authOptions: McpAuthOptions | undefined,
  authInfo: AuthInfo,
  scopes: RequiredScopes,
): boolean | undefined {
  if (!Array.isArray(authInfo.scopes)) return undefined;
  if (!authOptions?.scopeSatisfies) {
    return scopes.every((scope) => authInfo.scopes.includes(scope));
  }
  try {
    return authOptions.scopeSatisfies(authInfo.scopes, scopes) === true;
  } catch {
    return undefined;
  }
}

/**
 * The SDK `scopeChallenge` for a capability declaring `scopes`.
 *
 * Without a custom `auth.scopeSatisfies` it is the SDK's own `requireScopes`,
 * guarded so a grant without a `scopes` array is challenged rather than read
 * as a string or a set of characters. With one, the custom check decides, and
 * a check that throws challenges (fail closed).
 *
 * No `authInfo` means no challenge, matching `requireScopes`: an
 * unauthenticated request is the authentication gate's business, and a
 * server without `auth` keeps its behaviour. Anonymous requests under
 * `auth.optional` are handled at registration instead — see
 * {@link applyScopeVisibility}.
 */
export function scopeChallenge(
  authOptions: McpAuthOptions | undefined,
  scopes: RequiredScopes,
): ScopeChallengeHandler {
  const sdkChallenge = authOptions?.scopeSatisfies
    ? undefined
    : requireScopes(...scopes);

  return (context) => {
    const { authInfo } = context;
    if (!authInfo) return undefined;
    if (!Array.isArray(authInfo.scopes)) return { scopes };
    if (sdkChallenge) return sdkChallenge(context);
    return grantSatisfies(authOptions, authInfo, scopes)
      ? undefined
      : { scopes };
  };
}

/**
 * Requests admitted anonymously for their public capabilities. Keyed by the
 * request object, so an entry lives exactly as long as its request.
 */
const publicOnlyRequests = new WeakSet<object>();

/** Marks `request` as admitted only for public capabilities. */
export function markPublicOnly(request: AuthenticatedRequest): void {
  publicOnlyRequests.add(request);
}

/**
 * Whether `request` was admitted only for public capabilities — the registry
 * then disables every non-public capability for it.
 */
export function isPublicOnly(request: AuthenticatedRequest): boolean {
  return publicOnlyRequests.has(request);
}

/**
 * Disables a scoped capability the caller may not see, before any gate.
 *
 * - the request was admitted anonymously for `public` capabilities only
 *   (see `McpAuthService`): every non-public capability is disabled; if that
 *   `disable()` throws, so does this — the request fails rather than expose it.
 * - `auth` configured and the request is anonymous (`optional: true`): the
 *   SDK would not challenge it (no `authInfo`), so the capability is
 *   disabled — fail closed.
 * - `hideOutOfScope` (the capability's, else its resolver's, else
 *   `auth.hideOutOfScope`) and the grant does not satisfy `scopes`: disabled,
 *   so it is absent from lists and a direct call answers "disabled".
 * - the grant cannot be evaluated (no `scopes` array, or `auth.scopeSatisfies`
 *   threw): disabled whatever `hideOutOfScope` says — fail closed. Never
 *   throws outside the public-only case, so the registry's `enabled` toggle still runs when it returns
 *   `false`.
 *
 * @returns `true` when the capability was disabled.
 */
export function applyScopeVisibility(
  authOptions: McpAuthOptions | undefined,
  logger: McpLoggerService,
  access: CapabilityAccess,
  handle: McpCapabilityHandle,
  label: string,
  name: string,
  scope: string,
  context: McpRegistrationContext,
): boolean {
  // Admitted anonymously for public capabilities only: every other one is
  // disabled, scoped or not — unlisted, and "disabled" if called directly.
  if (!access.isPublic && isPublicOnly(context.request)) {
    disableCapability(logger, handle, label, name, scope, true);
    return true;
  }

  const { scopes } = access;
  if (!scopes || !authOptions) return false;

  // Capability > resolver > module.
  const hideOutOfScope =
    (access.hideOutOfScope ?? authOptions.hideOutOfScope) === true;

  const { authInfo } = context;
  let hidden = true;
  if (authInfo) {
    // `scopeSatisfies` is consulted only when its answer matters here; the
    // array check always runs, so a malformed grant never stays listed.
    const satisfied =
      hideOutOfScope || !Array.isArray(authInfo.scopes)
        ? grantSatisfies(authOptions, authInfo, scopes)
        : true;
    if (satisfied === undefined) {
      logger.error(
        `${label} "${name}": the grant's scopes could not be evaluated; disabling it for this request.`,
        undefined,
        scope,
      );
    } else {
      hidden = hideOutOfScope && !satisfied;
    }
  }

  if (hidden) disableCapability(logger, handle, label, name, scope);

  return hidden;
}
