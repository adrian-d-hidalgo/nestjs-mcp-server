import { Injectable } from '@nestjs/common';

import {
  AuthenticatedRequest,
  AuthInfo,
  McpAccessDeniedError,
  McpAuthorizer,
} from '../../src';

/** Demo tenants and the scopes a member may exercise in each. */
/** A `Map`, so a prototype key such as `toString` is never a tenant. */
const TENANT_SCOPES: ReadonlyMap<string, string[]> = new Map([
  ['acme', ['notes:read', 'notes:write']],
  ['acme-viewers', ['notes:read']],
]);

/**
 * Tenant-style request authorization: the `x-tenant` header selects a tenant,
 * and the caller's effective scopes become key scopes ∩ tenant scopes.
 *
 * Runs once per request, before the SDK evaluates any capability's `scopes`,
 * so the narrowed grant is what `hideOutOfScope` and the scope challenge see.
 */
@Injectable()
export class TenantAuthorizer implements McpAuthorizer {
  authorize(request: AuthenticatedRequest, auth: AuthInfo): AuthInfo {
    const tenant = request.headers['x-tenant'];
    if (tenant === undefined) return auth;

    const allowed =
      typeof tenant === 'string' ? TENANT_SCOPES.get(tenant) : undefined;
    if (!allowed) {
      throw new McpAccessDeniedError(
        `Not a member of tenant "${String(tenant)}"`,
      );
    }

    return {
      ...auth,
      scopes: auth.scopes.filter((scope) => allowed.includes(scope)),
      extra: { ...auth.extra, tenant },
    };
  }
}
