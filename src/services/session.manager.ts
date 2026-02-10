import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

type Session = {
  transport: StreamableHTTPServerTransport | SSEServerTransport;
  request: Request;
  lastActivity: number;
};

@Injectable()
export class SessionManager {
  private sessions = new Map<string, Session>();

  public getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Update last activity on access
      session.lastActivity = Date.now();
    }
    return session;
  }

  public setSession(
    sessionId: string,
    session: Omit<Session, 'lastActivity'>,
  ): void {
    this.sessions.set(sessionId, {
      ...session,
      lastActivity: Date.now(),
    });
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  public getInactiveSessions(timeoutMs: number): string[] {
    const now = Date.now();
    return Array.from(this.sessions.entries())
      .filter(([_, session]) => now - session.lastActivity > timeoutMs)
      .map(([sessionId]) => sessionId);
  }

  public getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }
}
