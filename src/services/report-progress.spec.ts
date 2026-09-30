import type { ServerContext } from '@modelcontextprotocol/server';

import { buildReportProgress, type ProgressWarnState } from './report-progress';

describe('buildReportProgress', () => {
  const logger = () => ({ warn: jest.fn(), debug: jest.fn() });

  const context = (
    meta?: Record<string, unknown>,
    notify: jest.Mock = jest.fn().mockResolvedValue(undefined),
  ) =>
    ({
      mcpReq: { id: 1, method: 'tools/call', _meta: meta, notify },
    }) as unknown as ServerContext;

  const notifyOf = (ctx: ServerContext) => ctx.mcpReq.notify as jest.Mock;

  const build = (
    sdkContext: ServerContext,
    overrides: Partial<Parameters<typeof buildReportProgress>[0]> = {},
  ) => {
    const log = logger();
    const warnState: ProgressWarnState = { warned: false };
    const reportProgress = buildReportProgress({
      sdkContext,
      era: 'modern',
      responseMode: undefined,
      logger: log,
      warnState,
      ...overrides,
    });
    return { reportProgress, log, warnState };
  };

  describe('token semantics', () => {
    it.each([['t'], [0], ['']])(
      'sends an exact notifications/progress payload for token %p',
      async (progressToken) => {
        const ctx = context({ progressToken });
        const { reportProgress } = build(ctx);

        await reportProgress(1, 3, 'step 1/3');

        expect(notifyOf(ctx)).toHaveBeenCalledTimes(1);
        expect(notifyOf(ctx)).toHaveBeenCalledWith({
          method: 'notifications/progress',
          params: { progressToken, progress: 1, total: 3, message: 'step 1/3' },
        });
      },
    );

    it('omits total and message when they are undefined', async () => {
      const ctx = context({ progressToken: 'x' });
      const { reportProgress } = build(ctx);

      await reportProgress(5);

      const [notification] = notifyOf(ctx).mock.calls[0] as [
        { params: Record<string, unknown> },
      ];
      expect(notification.params).toStrictEqual({
        progressToken: 'x',
        progress: 5,
      });
      expect('total' in notification.params).toBe(false);
      expect('message' in notification.params).toBe(false);
    });

    it('omits only message when total is given', async () => {
      const ctx = context({ progressToken: 'x' });
      const { reportProgress } = build(ctx);

      await reportProgress(2, 4);

      expect(notifyOf(ctx)).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: { progressToken: 'x', progress: 2, total: 4 },
      });
    });

    it('does not send when _meta is undefined', async () => {
      const ctx = context(undefined);
      const { reportProgress } = build(ctx);

      await expect(reportProgress(1)).resolves.toBeUndefined();

      expect(notifyOf(ctx)).not.toHaveBeenCalled();
    });

    it('does not send when _meta carries no progressToken', async () => {
      const ctx = context({});
      const { reportProgress } = build(ctx);

      await expect(reportProgress(1)).resolves.toBeUndefined();

      expect(notifyOf(ctx)).not.toHaveBeenCalled();
    });
  });

  describe('era gate', () => {
    it('drops progress on modern + json and warns exactly once', async () => {
      const ctx = context({ progressToken: 't' });
      const { reportProgress, log } = build(ctx, { responseMode: 'json' });

      await reportProgress(1);
      await reportProgress(2);
      await reportProgress(3);

      expect(notifyOf(ctx)).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(expect.any(String), 'progress');

      const [message] = log.warn.mock.calls[0] as [string];
      expect(message).toMatch(/json/);
      expect(message).toMatch(/auto/);
      expect(message).toMatch(/sse/);
    });

    it('warns once across two reporters sharing the same state', async () => {
      const warnState: ProgressWarnState = { warned: false };
      const log = logger();
      const first = context({ progressToken: 'secret-token-a' });
      const second = context(undefined);

      for (const sdkContext of [first, second]) {
        const reportProgress = buildReportProgress({
          sdkContext,
          era: 'modern',
          responseMode: 'json',
          logger: log,
          warnState,
        });
        await reportProgress(1, 2, 'secret-message');
      }

      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(notifyOf(first)).not.toHaveBeenCalled();
      expect(notifyOf(second)).not.toHaveBeenCalled();

      const [message] = log.warn.mock.calls[0] as [string];
      expect(message).not.toContain('secret-token-a');
      expect(message).not.toContain('secret-message');
    });

    it('warns on modern + json even when no token was sent', async () => {
      const ctx = context(undefined);
      const { reportProgress, log } = build(ctx, { responseMode: 'json' });

      await reportProgress(1);

      expect(log.warn).toHaveBeenCalledTimes(1);
    });

    it('delivers on legacy + json and does not warn', async () => {
      const ctx = context({ progressToken: 't' });
      const { reportProgress, log } = build(ctx, {
        era: 'legacy',
        responseMode: 'json',
      });

      await reportProgress(1, 2);

      expect(notifyOf(ctx)).toHaveBeenCalledTimes(1);
      expect(log.warn).not.toHaveBeenCalled();
    });

    it.each([['auto' as const], ['sse' as const], [undefined]])(
      'delivers on modern + %p without warning',
      async (responseMode) => {
        const ctx = context({ progressToken: 't' });
        const { reportProgress, log } = build(ctx, { responseMode });

        await reportProgress(1);

        expect(notifyOf(ctx)).toHaveBeenCalledTimes(1);
        expect(log.warn).not.toHaveBeenCalled();
      },
    );
  });

  describe('never rejects', () => {
    it('resolves and logs at debug without token or message when notify rejects', async () => {
      const ctx = context(
        { progressToken: 'secret-token-b' },
        // The legacy transport's message embeds the JSON-RPC request id.
        jest
          .fn()
          .mockRejectedValue(
            new Error('No connection established for request ID: 4242'),
          ),
      );
      const { reportProgress, log } = build(ctx);

      await expect(
        reportProgress(1, 2, 'secret-message'),
      ).resolves.toBeUndefined();

      expect(log.debug).toHaveBeenCalledTimes(1);
      const [line, scope] = log.debug.mock.calls[0] as [string, string];
      expect(scope).toBe('progress');
      expect(line).toBe('Progress notification not delivered (Error)');
      expect(line).not.toContain('4242');
      expect(line).not.toContain('secret-token-b');
      expect(line).not.toContain('secret-message');
    });

    it('resolves when notify rejects with a non-Error value', async () => {
      const ctx = context(
        { progressToken: 't' },
        jest.fn().mockRejectedValue('gone'),
      );
      const { reportProgress, log } = build(ctx);

      await expect(reportProgress(1)).resolves.toBeUndefined();
      expect(log.debug).toHaveBeenCalledWith(
        'Progress notification not delivered (string)',
        'progress',
      );
    });
  });

  describe('safe to detach', () => {
    it('sends when called without its owning object', async () => {
      const sdkContext = context({ progressToken: 't' });
      const ctx = { reportProgress: build(sdkContext).reportProgress };

      const f = ctx.reportProgress;
      await f(1);

      expect(notifyOf(sdkContext)).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: { progressToken: 't', progress: 1 },
      });
    });
  });
});
