import { Inject, Injectable } from '@nestjs/common';

import { McpCapabilityGate, McpRegistrationContext } from '../../src';
import { PermissionsService } from './permissions.service';

/**
 * The shape this feature exists for: a gate class with an **injected service**,
 * answering **asynchronously**, evaluated once while this connection's server
 * is being populated.
 *
 * It decides what this connection may discover — it is not an authorization
 * check. Use `@UseGuards` for that: guards run on every invocation, against
 * that invocation's own context.
 *
 * `authInfo` is only populated when auth middleware ran before the MCP
 * controller, so it is always optional-chained.
 */
@Injectable()
export class AdminGate implements McpCapabilityGate {
  constructor(private readonly permissions: PermissionsService) {}

  isEnabled(context: McpRegistrationContext): Promise<boolean> {
    const role = context.request.headers['x-role'];

    return this.permissions.isAdmin(
      typeof role === 'string' ? role : undefined,
      context.authInfo?.clientId,
    );
  }
}

/**
 * A deliberately slow gate. With `AdminGate` it demonstrates the cost contract:
 * every gate settles in one concurrency wave, so a connection pays the slowest
 * single gate rather than the sum of them.
 */
@Injectable()
export class BetaGate implements McpCapabilityGate {
  constructor(private readonly permissions: PermissionsService) {}

  isEnabled(): Promise<boolean> {
    return this.permissions.isBetaEnabled();
  }
}

/**
 * A gate whose promise **rejects**. Fails closed — a distinct code path from a
 * synchronous throw, and the one a naive `try { gate.isEnabled(ctx) } catch`
 * misses entirely.
 */
@Injectable()
export class RejectingGate implements McpCapabilityGate {
  isEnabled(): Promise<boolean> {
    return Promise.reject(
      new Error('entitlements lookup timed out for this connection'),
    );
  }
}

/** A gate that throws synchronously. Fails closed. */
@Injectable()
export class ThrowingGate implements McpCapabilityGate {
  isEnabled(): boolean {
    throw new Error('entitlements service unreachable');
  }
}

/**
 * Registered in **no** module, and depending on a token nothing provides — so
 * neither `moduleRef.get` nor `moduleRef.create` can build it.
 *
 * Fails closed, and is never instantiated with `new`: a `new`-built gate has
 * `undefined` dependencies and could answer something accidentally truthy,
 * which would be a fail-**open**.
 */
@Injectable()
export class UnresolvableGate implements McpCapabilityGate {
  constructor(
    @Inject('ENTITLEMENTS_CLIENT')
    private readonly client: { allowed: boolean },
  ) {}

  isEnabled(): boolean {
    return this.client.allowed;
  }
}
