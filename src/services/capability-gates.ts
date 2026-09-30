import type {
  RegisteredPrompt,
  RegisteredResource,
  RegisteredResourceTemplate,
  RegisteredTool,
} from '@modelcontextprotocol/server';
import type { Type } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';

import type {
  McpCapabilityGate,
  McpCapabilityToggle,
  McpRegistrationContext,
} from '../interfaces/registration-context.interface';
import type { McpLoggerService } from './logger.service';

/**
 * Internal to `RegistryService`: the capability `enabled` toggle and the
 * per-request gate wave. Not part of the public API — nothing here is
 * re-exported from the package entry.
 */

/** The four SDK registration handles, all of which expose `disable()`. */
export type McpCapabilityHandle =
  | RegisteredPrompt
  | RegisteredResource
  | RegisteredResourceTemplate
  | RegisteredTool;

/**
 * A capability that is registered and whose gate has not been consulted yet.
 *
 * Registration is synchronous by design: every SDK call, and every `disable()`
 * for a static `enabled: false`, completes before the first `await`. Anything
 * gated by a class lands here instead and is settled in one concurrency wave
 * once all three register methods have returned.
 *
 * The list is local to a `registerAll` call and released with it — no handle is
 * retained beyond the call.
 */
export interface PendingCapabilityGate {
  handle: McpCapabilityHandle;
  /** Capability label used in the log line, e.g. `Tool`. */
  label: string;
  name: string;
  /** Logger context — `tools`, `prompts` or `resources`. */
  scope: string;
  Gate: Type<McpCapabilityGate>;
}

/**
 * A gate's answer, plus why it was negative when the gate could not be asked.
 *
 * The reason travels with the verdict instead of being logged where it is
 * produced, so a shared gate can be consulted once while each capability it
 * disables still gets a log line naming it.
 */
interface GateVerdict {
  enabled: boolean;
  reason?: string;
}

/**
 * Memoises each gate class's verdict for the life of one `registerAll` call.
 *
 * Keyed by class, not by capability: the registration context is one object
 * for the whole call, so ten tools sharing `AdminGate` ask it once rather than
 * ten times. Never outlives the call — a verdict reused across requests would
 * defeat the entire point of evaluating per request.
 */
type GateVerdictCache = Map<Type<McpCapabilityGate>, Promise<GateVerdict>>;

/**
 * Thrown by {@link disableCapability} with `failClosed`: the registry rethrows
 * it past its per-capability `try/catch`, so the whole request fails instead
 * of serving a capability that had to be withheld.
 */
export class CapabilityDisableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CapabilityDisableError';
  }
}

/**
 * Disables a capability whose `enabled` toggle resolved to `false`.
 *
 * The `disable()` call is isolated from the surrounding registration
 * `try/catch` deliberately. If it threw there, the outer handler would log
 * "Error registering <name>" and the capability would stay **enabled** —
 * failing open, the exact inversion of the consumer's intent. Here the
 * failure gets its own log line that says the capability is still exposed.
 *
 * With `failClosed` (a non-public capability for a request admitted for
 * `public` capabilities only), a failing `disable()` instead throws a
 * {@link CapabilityDisableError}, failing the request: that caller was never
 * authenticated, so leaving the capability enabled is not an option.
 *
 * @param logger The registry's logger.
 * @param handle The SDK registration handle returned by `registerTool` /
 * `registerPrompt` / `registerResource`.
 * @param label Capability label used in the log line, e.g. `Tool`.
 * @param name The capability name.
 * @param scope Logger context — `tools`, `prompts` or `resources`.
 * @param failClosed Throw rather than leave the capability enabled.
 */
export function disableCapability(
  logger: McpLoggerService,
  handle: McpCapabilityHandle,
  label: string,
  name: string,
  scope: string,
  failClosed = false,
): void {
  try {
    handle.disable();
    logger.log(`${label} "${name}" disabled for this request.`, scope);
  } catch (error) {
    if (failClosed) {
      logger.error(
        `Failed to disable ${label.toLowerCase()} "${name}": failing the request rather than exposing it. ${error}`,
        undefined,
        scope,
      );
      throw new CapabilityDisableError(
        `Could not disable ${label.toLowerCase()} "${name}": ${error}`,
        { cause: error },
      );
    }
    logger.error(
      `Failed to disable ${label.toLowerCase()} "${name}": it remains enabled for this request. ${error}`,
      undefined,
      scope,
    );
  }
}

/**
 * Applies a capability's `enabled` toggle at registration time.
 *
 * Synchronous on purpose — this is the hot path every capability walks:
 *
 * - absent / `true` — nothing happens, and nothing is deferred.
 * - `false` — disabled immediately, with no container round-trip.
 * - a gate class — deferred to the concurrency wave in `registerAll`.
 *
 * @param logger The registry's logger.
 * @param toggle The capability's `enabled` option, if it declared one.
 * @param handle The SDK registration handle just bound for this capability.
 * @param label Capability label used in the log line, e.g. `Tool`.
 * @param name The capability name.
 * @param scope Logger context — `tools`, `prompts` or `resources`.
 * @param pending The `registerAll` call's list of deferred gates.
 */
export function applyCapabilityToggle(
  logger: McpLoggerService,
  toggle: McpCapabilityToggle | undefined,
  handle: McpCapabilityHandle,
  label: string,
  name: string,
  scope: string,
  pending: PendingCapabilityGate[],
): void {
  if (toggle === undefined || toggle === true) return;

  if (toggle === false) {
    disableCapability(logger, handle, label, name, scope);
    return;
  }

  pending.push({ handle, label, name, scope, Gate: toggle });
}

/**
 * Settles every deferred gate in one concurrency wave.
 *
 * Each evaluation is written so it can never reject, so `Promise.all` never
 * short-circuits: one failing gate can neither abort the wave nor strip the
 * capabilities beside it, and nothing escapes into the transport's
 * `try/catch` to turn the request into a 500.
 */
export async function settlePendingGates(
  moduleRef: ModuleRef,
  logger: McpLoggerService,
  pending: PendingCapabilityGate[],
  context: McpRegistrationContext,
): Promise<void> {
  if (!pending.length) return;

  // Call-local: one verdict per distinct gate class per request, released
  // with the call.
  const cache: GateVerdictCache = new Map();

  await Promise.all(
    pending.map(async (capability) => {
      const enabled = await isCapabilityEnabled(
        moduleRef,
        logger,
        capability,
        context,
        cache,
      );

      if (!enabled) {
        disableCapability(
          logger,
          capability.handle,
          capability.label,
          capability.name,
          capability.scope,
        );
      }
    }),
  );
}

/**
 * Resolves a capability gate class through the Nest container.
 *
 * Mirrors `RegistryService.resolveGuard` with one deliberate divergence: there
 * is no `new Gate()` fallback. A gate built with `new` bypasses DI, leaving
 * every injected field `undefined`, and such a gate either throws or returns
 * something accidentally truthy — a fail-**open**, which this design forbids.
 * `moduleRef.create` already covers a dependency-free class, so the third
 * fallback would buy nothing and risk the one outcome that is unacceptable.
 *
 * Never rejects: `null` means "could not resolve", which the caller turns
 * into a disabled capability plus a log line naming it.
 */
async function resolveGate(
  moduleRef: ModuleRef,
  Gate: Type<McpCapabilityGate>,
): Promise<McpCapabilityGate | null> {
  try {
    return moduleRef.get<McpCapabilityGate>(Gate, { strict: false });
  } catch {
    try {
      return await moduleRef.create<McpCapabilityGate>(Gate);
    } catch {
      // Logged by the caller, which knows which capability is affected. One
      // resolution can be shared by many capabilities, so logging here would
      // name the gate but not the capability the consumer is looking for.
      return null;
    }
  }
}

/**
 * Asks a capability's gate whether it is available to this request.
 *
 * Fails **closed** on every failure mode, because failing open would silently
 * expose a capability the consumer intended to gate:
 *
 * 1. `isEnabled` throws synchronously.
 * 2. `isEnabled` returns a **rejecting** promise — a distinct path, which is
 *    why the `try` wraps the `await` and not merely the call.
 * 3. the gate class cannot be resolved from the container.
 *
 * Never rejects, so the surrounding `Promise.all` can never short-circuit.
 *
 * @param capability The deferred capability and its gate class.
 * @param context The request context.
 * @param cache Per-call memo, so N capabilities sharing one gate class cost
 * one container resolution and one `isEnabled` call between them.
 */
async function isCapabilityEnabled(
  moduleRef: ModuleRef,
  logger: McpLoggerService,
  capability: PendingCapabilityGate,
  context: McpRegistrationContext,
  cache: GateVerdictCache,
): Promise<boolean> {
  const { Gate, name, scope } = capability;

  let verdict = cache.get(Gate);

  if (!verdict) {
    verdict = evaluateGate(moduleRef, Gate, context);
    cache.set(Gate, verdict);
  }

  const { enabled, reason } = await verdict;

  // Logged here, per capability, rather than inside `evaluateGate`: the gate
  // is consulted once and shared, but the consumer needs to know which
  // capability of theirs vanished, not merely that some gate failed.
  if (reason) {
    logger.error(`Disabling "${name}": ${reason}`, undefined, scope);
  }

  return enabled;
}

/**
 * Resolves a gate class and asks it, once per request.
 *
 * Shared by every capability declaring the same gate, so the verdict is
 * computed once and the failure reason is returned rather than logged — the
 * caller logs it against each affected capability by name.
 */
async function evaluateGate(
  moduleRef: ModuleRef,
  Gate: Type<McpCapabilityGate>,
  context: McpRegistrationContext,
): Promise<GateVerdict> {
  const gate = await resolveGate(moduleRef, Gate);

  if (!gate) {
    return {
      enabled: false,
      reason: `its "enabled" gate ${Gate.name} could not be resolved from the container. Register it as a provider.`,
    };
  }

  try {
    // The await is inside the try on purpose: a rejected promise and a
    // synchronous throw are different code paths, and wrapping only the call
    // would catch the second and miss the first.
    const result = await gate.isEnabled(context);

    // Strict comparison, not truthiness: anything that is not exactly `true`
    // — including a value a JavaScript caller slipped past the types — is
    // treated as a denial rather than accidentally exposing the capability.
    return { enabled: result === true };
  } catch (error) {
    return {
      enabled: false,
      reason: `its "enabled" gate ${Gate.name} failed: ${error}`,
    };
  }
}
