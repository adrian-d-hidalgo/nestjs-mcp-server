import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Injectable } from '@nestjs/common';
import { Request } from 'express';

type Session = {
  transport: StreamableHTTPServerTransport | SSEServerTransport;
  request: Request;
};

@Injectable()
export class SessionManager {
  private sessions = new Map<string, Session>();

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public setSession(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
  }

  public deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
