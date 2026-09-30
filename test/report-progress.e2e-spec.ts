import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type { Progress } from '@modelcontextprotocol/server';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { McpLoggerService } from '../src/services/logger.service';
import {
  JsonProgressModule,
  ProgressModule,
  SseProgressModule,
} from './fixtures/features.module';
import { e2eLogger } from './support/logger';

/**
 * `McpContext.reportProgress` on the wire, across both protocol eras and the
 * `responseMode` settings that change whether progress can be delivered.
 *
 * The modern era is driven with raw HTTP (no published client speaks it); the
 * legacy era with the real v2 client and its `onprogress` callback.
 */

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'progress-e2e', version: '1' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

interface Frame {
  id?: number;
  method?: string;
  params?: {
    progressToken?: string | number;
    progress?: number;
    total?: number;
    message?: string;
  };
  result?: {
    content?: { type: string; text: string }[];
    messages?: { content: { text: string } }[];
  };
  error?: { code: number; message: string };
}

const boot = async (mod: unknown): Promise<[INestApplication, string]> => {
  const fixture: TestingModule = await Test.createTestingModule({
    imports: [mod as never],
  }).compile();

  const app = fixture.createNestApplication({ logger: e2eLogger() });
  await app.listen(0);

  const server = app.getHttpServer() as Server;
  return [app, `http://localhost:${(server.address() as AddressInfo).port}`];
};

/**
 * A modern-era call. `progressToken`, when given, is set beside the envelope
 * keys in `_meta` — where a client asks for progress.
 */
const modernCall = async (
  baseUrl: string,
  method: 'tools/call' | 'prompts/get',
  params: { name: string; arguments?: Record<string, unknown> },
  id: number,
  progressToken?: string | number,
): Promise<{ contentType: string; frames: Frame[] }> => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      'Mcp-Name': params.name,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: {
        ...params,
        _meta: {
          ...ENVELOPE,
          ...(progressToken !== undefined && { progressToken }),
        },
      },
    }),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  // A JSON answer is one body; an SSE answer is `data:` lines, one per frame.
  const frames = contentType.includes('text/event-stream')
    ? text
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => JSON.parse(line.slice('data:'.length)) as Frame)
    : [JSON.parse(text) as Frame];

  return { contentType, frames };
};

const progressFrames = (frames: Frame[]) =>
  frames.filter((f) => f.method === 'notifications/progress');

/** The three progress params `count_up` emits for `steps: 3`. */
const threeSteps = (progressToken: string) =>
  [1, 2, 3].map((progress) => ({
    progressToken,
    progress,
    total: 3,
    message: `step ${progress}/3`,
  }));

/** Calls `count_up` through the real v2 client, collecting progress. */
const legacyCountUp = async (baseUrl: string, steps: number) => {
  const client = new Client({ name: 'progress-legacy', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/mcp`),
  );
  const updates: Progress[] = [];

  try {
    await client.connect(transport);
    const result = await client.callTool(
      { name: 'count_up', arguments: { steps } },
      { onprogress: (update) => updates.push(update) },
    );
    return { result, updates };
  } finally {
    await transport.close();
  }
};

describe('reportProgress, responseMode auto (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    [app, baseUrl] = await boot(ProgressModule);
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams ordered progress frames carrying the token, then the result', async () => {
    const { contentType, frames } = await modernCall(
      baseUrl,
      'tools/call',
      { name: 'count_up', arguments: { steps: 3 } },
      11,
      'modern-token',
    );

    expect(contentType).toContain('text/event-stream');

    const progress = progressFrames(frames);
    expect(progress.map((f) => f.params)).toEqual(threeSteps('modern-token'));

    // The result is the last frame, after every progress frame.
    const last = frames[frames.length - 1];
    expect(last.id).toBe(11);
    expect(last.result?.content?.[0]?.text).toBe('counted to 3');
    expect(frames).toHaveLength(4);
  });

  it('delivers the numeric token 0', async () => {
    const { frames } = await modernCall(
      baseUrl,
      'tools/call',
      { name: 'count_up', arguments: { steps: 2 } },
      12,
      0,
    );

    expect(progressFrames(frames).map((f) => f.params?.progressToken)).toEqual([
      0, 0,
    ]);
  });

  it('answers a single JSON body when the client sent no token', async () => {
    const { contentType, frames } = await modernCall(
      baseUrl,
      'tools/call',
      { name: 'count_up', arguments: { steps: 3 } },
      13,
    );

    expect(contentType).toContain('application/json');
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe(13);
    expect(frames[0].result?.content?.[0]?.text).toBe('counted to 3');
  });

  it('streams progress from a prompt handler', async () => {
    const { contentType, frames } = await modernCall(
      baseUrl,
      'prompts/get',
      { name: 'assemble_briefing' },
      14,
      'prompt-token',
    );

    expect(contentType).toContain('text/event-stream');
    expect(
      progressFrames(frames).map((f) => [
        f.params?.progressToken,
        f.params?.progress,
        f.params?.message,
      ]),
    ).toEqual([
      ['prompt-token', 1, 'gathering'],
      ['prompt-token', 2, 'assembling'],
    ]);

    const last = frames[frames.length - 1];
    expect(last.id).toBe(14);
    expect(last.result?.messages?.[0]?.content.text).toBe('briefing ready');
  });

  it('delivers progress to a legacy-era client through onprogress', async () => {
    const { result, updates } = await legacyCountUp(baseUrl, 3);

    expect(updates.map((u) => u.progress)).toEqual([1, 2, 3]);
    expect(updates.every((u) => u.total === 3)).toBe(true);
    expect(updates[2].message).toBe('step 3/3');
    expect(result.content).toEqual([{ type: 'text', text: 'counted to 3' }]);
  });
});

describe('reportProgress, responseMode sse (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    [app, baseUrl] = await boot(SseProgressModule);
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams the same ordered progress frames, then the result', async () => {
    const { contentType, frames } = await modernCall(
      baseUrl,
      'tools/call',
      { name: 'count_up', arguments: { steps: 3 } },
      31,
      'sse-token',
    );

    expect(contentType).toContain('text/event-stream');
    expect(frames).toHaveLength(4);
    expect(frames.slice(0, 3).map((f) => f.method)).toEqual([
      'notifications/progress',
      'notifications/progress',
      'notifications/progress',
    ]);
    expect(progressFrames(frames).map((f) => f.params)).toEqual(
      threeSteps('sse-token'),
    );

    const last = frames[3];
    expect(last.id).toBe(31);
    expect(last.result?.content?.[0]?.text).toBe('counted to 3');
  });
});

describe('reportProgress, responseMode json (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let warn: jest.SpiedFunction<McpLoggerService['warn']>;

  beforeAll(async () => {
    warn = jest.spyOn(McpLoggerService.prototype, 'warn');
    [app, baseUrl] = await boot(JsonProgressModule);
  });

  afterAll(async () => {
    warn.mockRestore();
    await app.close();
  });

  const progressWarnings = () =>
    warn.mock.calls.filter(([, scope]) => scope === 'progress');

  it('drops progress on a modern-era request, answers JSON, and warns once', async () => {
    for (const id of [21, 22]) {
      const { contentType, frames } = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'count_up', arguments: { steps: 3 } },
        id,
        'json-token',
      );

      expect(contentType).toContain('application/json');
      expect(frames).toHaveLength(1);
      expect(frames[0].id).toBe(id);
      expect(frames[0].result?.content?.[0]?.text).toBe('counted to 3');
    }

    // Six reportProgress calls over two requests: one warning, no token.
    expect(progressWarnings()).toHaveLength(1);
    expect(String(progressWarnings()[0][0])).not.toContain('json-token');
  });

  it('still delivers progress to a legacy-era client', async () => {
    const { result, updates } = await legacyCountUp(baseUrl, 3);

    // The SDK's legacy leg ignores responseMode and always streams, so the
    // era gate must let legacy traffic through. Pins that SDK behaviour.
    expect(updates.map((u) => u.progress)).toEqual([1, 2, 3]);
    expect(result.content).toEqual([{ type: 'text', text: 'counted to 3' }]);
  });
});
