import { ToolHandlerArgs } from './tool.args';

describe('ToolHandlerArgs', () => {
  const extra = {
    headers: { foo: 'bar' },
    signal: new AbortController().signal,
    requestId: 'test',
    sendNotification: jest.fn(),
    sendRequest: jest.fn(),
  };

  it('should construct with static from (only extra)', () => {
    const args = ToolHandlerArgs.from(extra);
    expect(args.extra).toBe(extra);
    expect(args.args).toBeUndefined();
  });

  it('should construct with static from (extra and args)', () => {
    const params = { foo: 'baz' };
    const args = ToolHandlerArgs.from(extra, params);
    expect(args.extra).toBe(extra);
    expect(args.args).toBe(params);
  });

  it('should construct with args as empty object', () => {
    const args = ToolHandlerArgs.from(extra, {});
    expect(args.args).toEqual({});
  });

  it('should construct with extra with empty headers', () => {
    const emptyHeadersExtra = {
      headers: {},
      signal: new AbortController().signal,
      requestId: 'empty',
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
    };
    const args = ToolHandlerArgs.from(emptyHeadersExtra, { foo: 'bar' });
    expect(args.extra).toBe(emptyHeadersExtra);
    expect(args.args).toEqual({ foo: 'bar' });
  });

  it('should construct with extra with different requestId', () => {
    const diffExtra = { ...extra, requestId: 'diff' };
    const args = ToolHandlerArgs.from(diffExtra, { foo: 'bar' });
    expect(args.extra.requestId).toBe('diff');
    expect(args.args).toEqual({ foo: 'bar' });
  });
});
