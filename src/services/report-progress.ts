import type {
  ProgressNotification,
  ProgressToken,
  ProtocolEra,
  ServerContext,
} from '@modelcontextprotocol/server';

import type { McpContext } from '../interfaces/handler-context.interface';
import type { McpTransportOptions } from '../mcp.types';
import type { McpLoggerService } from './logger.service';

/**
 * Internal to `RegistryService`: builds `McpContext.reportProgress`. Not part
 * of the public API — nothing here is re-exported from the package entry.
 */

/**
 * Whether the "progress is dropped under `responseMode: 'json'`" line has been
 * logged. One per `RegistryService` instance, so separate Nest apps in one
 * process do not share it. Holds a boolean only — never request data.
 */
export interface ProgressWarnState {
  warned: boolean;
}

interface ReportProgressOptions {
  /** The SDK context of the invocation progress is reported for. */
  sdkContext: ServerContext;
  /** The protocol era the invocation is being served under. */
  era: ProtocolEra;
  /** The endpoint's configured `responseMode`; `undefined` means `'auto'`. */
  responseMode: McpTransportOptions['responseMode'];
  logger: Pick<McpLoggerService, 'warn' | 'debug'>;
  warnState: ProgressWarnState;
}

const JSON_MODE_WARNING =
  "reportProgress: progress notifications are dropped on modern-era (2026-07-28) requests under transport responseMode 'json'. Use responseMode 'auto' (the default) or 'sse' to deliver them. Legacy-era requests are unaffected.";

/**
 * Builds the `reportProgress` function for one invocation.
 *
 * A thin wrapper over the SDK's documented pattern — read
 * `mcpReq._meta.progressToken`, then `mcpReq.notify(notifications/progress)` —
 * that also:
 *
 * - on a modern-era request under `responseMode: 'json'`, where the SDK drops
 *   related notifications, sends nothing and warns once (checked before the
 *   token, so the warning surfaces even with a client that sends no token);
 * - treats a missing token as a no-op — `0` and `""` are real tokens;
 * - never rejects: a failed send means the exchange is already over, and
 *   progress is advisory. The failure is logged at `debug` with the error's
 *   name only — SDK messages can embed the request id — so the token, the
 *   request id and the consumer's `message` all stay out of logs.
 *
 * The result closes over its arguments and never reads `this`, so it is safe
 * to pass detached (`service.run(ctx.reportProgress)`).
 */
export function buildReportProgress({
  sdkContext,
  era,
  responseMode,
  logger,
  warnState,
}: ReportProgressOptions): McpContext['reportProgress'] {
  return async (progress, total, message) => {
    if (era === 'modern' && responseMode === 'json') {
      if (!warnState.warned) {
        warnState.warned = true;
        logger.warn(JSON_MODE_WARNING, 'progress');
      }
      return;
    }

    const progressToken: ProgressToken | undefined =
      sdkContext.mcpReq._meta?.progressToken;

    if (progressToken === undefined) return;

    const notification: ProgressNotification = {
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        ...(total !== undefined && { total }),
        ...(message !== undefined && { message }),
      },
    };

    try {
      await sdkContext.mcpReq.notify(notification);
    } catch (error) {
      // The error's name only: SDK messages can embed the JSON-RPC request
      // id, and nothing request-specific belongs in this line.
      logger.debug(
        `Progress notification not delivered (${error instanceof Error ? error.name : typeof error})`,
        'progress',
      );
    }
  };
}
