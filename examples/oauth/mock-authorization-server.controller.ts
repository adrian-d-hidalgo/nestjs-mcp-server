/**
 * HTTP surface of the MOCK OAuth 2.1 authorization server
 * (`mock-authorization-server.ts`).
 *
 * DEMO ONLY — tests and demos, NEVER production.
 */
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { JWK } from 'jose';

import {
  Outcome,
  Params,
  SESSION_COOKIE,
  SESSION_TTL,
  TOKEN_REALM,
} from './mock-authorization-protocol';
import { MockAuthorizationServer } from './mock-authorization-server';
import { InvalidClientException } from './mock-client-authentication';
import { MOCK_AS_PREFIX } from './oauth.config';

/** Reads one cookie off a `Cookie` header. */
const readCookie = (
  header: string | undefined,
  name: string,
): string | undefined => {
  for (const pair of (header ?? '').split(';')) {
    const eq = pair.indexOf('=');
    if (eq > 0 && pair.slice(0, eq).trim() === name) {
      return pair.slice(eq + 1).trim();
    }
  }
  return undefined;
};

/** Headers of every login, consent and error page. */
const PAGE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

/**
 * HTTP surface of the mock AS. Metadata is served at the RFC 8414
 * path-inserted URL for the issuer `<origin>/oauth` and at the root
 * well-known URL, for clients that only try the latter. CORS (browser-based
 * clients such as the Inspector) is enabled app-wide in `main.ts`.
 */
@Controller()
export class MockAuthorizationServerController {
  constructor(private readonly as: MockAuthorizationServer) {}

  @Get([
    `.well-known/oauth-authorization-server/${MOCK_AS_PREFIX}`,
    '.well-known/oauth-authorization-server',
  ])
  metadata(): Record<string, unknown> {
    return this.as.metadata;
  }

  @Get(`${MOCK_AS_PREFIX}/jwks`)
  jwks(): { keys: JWK[] } {
    return this.as.jwks;
  }

  @Post(`${MOCK_AS_PREFIX}/register`)
  register(@Body() body: Params): Params {
    return this.as.register(body ?? {});
  }

  @Get(`${MOCK_AS_PREFIX}/authorize`)
  authorize(
    @Query() query: Params,
    @Headers('cookie') cookie: string | undefined,
    @Res() res: Response,
  ): void {
    this.send(
      res,
      this.as.authorize(query, readCookie(cookie, SESSION_COOKIE)),
    );
  }

  @Post(`${MOCK_AS_PREFIX}/login`)
  login(@Body() body: Params, @Res() res: Response): void {
    this.send(res, this.as.login(body ?? {}));
  }

  @Post(`${MOCK_AS_PREFIX}/consent`)
  consent(
    @Body() body: Params,
    @Headers('cookie') cookie: string | undefined,
    @Res() res: Response,
  ): void {
    this.send(
      res,
      this.as.consent(body ?? {}, readCookie(cookie, SESSION_COOKIE)),
    );
  }

  @Post(`${MOCK_AS_PREFIX}/token`)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async token(
    @Body() body: Params,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Params> {
    try {
      return await this.as.token(body ?? {}, authorization);
    } catch (error) {
      throw this.challenge(res, error);
    }
  }

  @Post(`${MOCK_AS_PREFIX}/revoke`)
  @HttpCode(200)
  revoke(
    @Body() body: Params,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): void {
    try {
      this.as.revoke(body ?? {}, authorization);
    } catch (error) {
      throw this.challenge(res, error);
    }
  }

  /** RFC 6749 §5.2 / RFC 9110 §15.5.2: a 401 carries a challenge. */
  private challenge(res: Response, error: unknown): unknown {
    if (error instanceof InvalidClientException) {
      res.setHeader('WWW-Authenticate', `Basic realm="${TOKEN_REALM}"`);
    }
    return error;
  }

  private send(res: Response, outcome: Outcome): void {
    if (outcome.session !== undefined) {
      res.cookie(SESSION_COOKIE, outcome.session, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.as.secureCookies,
        path: `/${MOCK_AS_PREFIX}`,
        maxAge: SESSION_TTL * 1000,
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    if (outcome.redirect !== undefined) {
      res.redirect(302, outcome.redirect);
      return;
    }
    res
      .status(outcome.status)
      .set(PAGE_HEADERS)
      .type('html')
      .send(outcome.html);
  }
}
