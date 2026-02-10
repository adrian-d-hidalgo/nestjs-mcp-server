import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';

import { AppModule } from '../examples/tools/app.module';
import { SessionManager } from '../src/services/session.manager';
import { StreamableService } from '../src/transports/streamable/streamable.service';

describe('Session Cleanup (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let sessionManager: SessionManager;
  let streamableService: StreamableService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;

    // Get service instances for testing
    sessionManager = moduleFixture.get<SessionManager>(SessionManager);
    streamableService = moduleFixture.get<StreamableService>(StreamableService);
  });

  afterAll(async () => {
    // Stop cleanup timers before closing the app
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (streamableService as any).stopCleanupJob?.();
    await app.close();
  }, 60000);

  describe('Inactive Session Cleanup', () => {
    it('should cleanup sessions that have been inactive for 30+ minutes', async () => {
      // Create a session
      const client = new Client({
        name: 'cleanup-test-client',
        version: '1.0.0',
      });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );
      await client.connect(transport);

      // Verify session was created
      const initialSessionCount = sessionManager.getActiveSessionCount();
      expect(initialSessionCount).toBeGreaterThan(0);

      // Get the session ID (we need to access it via the transport)
      const sessionIds = sessionManager.getAllSessionIds();
      const sessionId = sessionIds[sessionIds.length - 1]; // Most recent session

      // Manually set lastActivity to 31 minutes ago (simulate inactivity)
      const session = sessionManager.getSession(sessionId);
      if (session) {
        // Force lastActivity to be old
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (session as any).lastActivity = Date.now() - 31 * 60 * 1000;
      }

      // Trigger cleanup manually (instead of waiting 5 minutes)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (streamableService as any).cleanupInactiveSessions();

      // Verify session was cleaned up
      const finalSessionCount = sessionManager.getActiveSessionCount();
      expect(finalSessionCount).toBe(initialSessionCount - 1);

      // Verify session is gone
      const cleanedSession = sessionManager.getSession(sessionId);
      expect(cleanedSession).toBeUndefined();

      // Cleanup - close transport if still open
      try {
        await transport.close();
      } catch {
        // Transport might already be closed by cleanup
      }
    }, 10000);

    it('should NOT cleanup sessions that are still active', async () => {
      // Create a session
      const client = new Client({
        name: 'active-test-client',
        version: '1.0.0',
      });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );
      await client.connect(transport);

      const initialSessionCount = sessionManager.getActiveSessionCount();

      // Get the session ID
      const sessionIds = sessionManager.getAllSessionIds();
      const sessionId = sessionIds[sessionIds.length - 1];

      // Session should have recent lastActivity (just created)
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();

      // Trigger cleanup (should not affect recent sessions)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (streamableService as any).cleanupInactiveSessions();

      // Verify session is still there
      const finalSessionCount = sessionManager.getActiveSessionCount();
      expect(finalSessionCount).toBe(initialSessionCount);

      const stillActiveSession = sessionManager.getSession(sessionId);
      expect(stillActiveSession).toBeDefined();

      // Cleanup
      await transport.close();
    }, 10000);
  });

  describe('Session Limit Protection', () => {
    it('should reject new sessions when limit is reached', async () => {
      // Get current session count
      const initialCount = sessionManager.getActiveSessionCount();

      // Override the maxConcurrentSessions to a low value for testing
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const originalLimit = (streamableService as any).maxConcurrentSessions;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (streamableService as any).maxConcurrentSessions = initialCount + 1;

      try {
        // Create one more session (should succeed - at limit)
        const client1 = new Client({
          name: 'limit-test-1',
          version: '1.0.0',
        });
        const transport1 = new StreamableHTTPClientTransport(
          new URL(`${baseUrl}/mcp`),
        );
        await client1.connect(transport1);

        expect(sessionManager.getActiveSessionCount()).toBe(initialCount + 1);

        // Try to create another session (should fail - over limit)
        const client2 = new Client({
          name: 'limit-test-2',
          version: '1.0.0',
        });
        const transport2 = new StreamableHTTPClientTransport(
          new URL(`${baseUrl}/mcp`),
        );

        // This should throw or fail to connect
        await expect(client2.connect(transport2)).rejects.toThrow();

        // Session count should not increase
        expect(sessionManager.getActiveSessionCount()).toBe(initialCount + 1);

        // Cleanup
        await transport1.close();
      } finally {
        // Restore original limit
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        (streamableService as any).maxConcurrentSessions = originalLimit;
      }
    }, 15000);
  });

  describe('Session Activity Tracking', () => {
    it('should update lastActivity when session is accessed', async () => {
      // Create a session
      const client = new Client({
        name: 'activity-test-client',
        version: '1.0.0',
      });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );
      await client.connect(transport);

      // Get session ID
      const sessionIds = sessionManager.getAllSessionIds();
      const sessionId = sessionIds[sessionIds.length - 1];

      // Get initial lastActivity
      const session1 = sessionManager.getSession(sessionId);
      const initialActivity = session1?.lastActivity;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Access session again (should update lastActivity)
      const session2 = sessionManager.getSession(sessionId);
      const updatedActivity = session2?.lastActivity;

      // Verify lastActivity was updated
      expect(updatedActivity).toBeDefined();
      expect(initialActivity).toBeDefined();
      expect(updatedActivity!).toBeGreaterThan(initialActivity!);

      // Cleanup
      await transport.close();
    }, 10000);
  });
});
