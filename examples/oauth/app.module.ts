import { DynamicModule, Module } from '@nestjs/common';

import { McpModule } from '../../src';
import { ForceUnauthorizedGuard } from './force-unauthorized.guard';
import { JwksJwtStrategy } from './jwks-jwt.strategy';
import { MockAuthorizationServer } from './mock-authorization-server';
import { MockAuthorizationServerController } from './mock-authorization-server.controller';
import {
  OAUTH_EXAMPLE_CONFIG,
  OAuthExampleConfig,
  resolveOAuthConfig,
  SCOPES,
} from './oauth.config';
import { createNotesResolver } from './notes.resolver';

/** Port the example listens on. */
export const PORT = Number(process.env.PORT ?? 3200);

@Module({})
export class OAuthExampleModule {
  /**
   * The resource URL and issuer are part of the configuration, so they must
   * be known before the module is built — hence a module factory.
   */
  static forConfig(config: OAuthExampleConfig): DynamicModule {
    const mock = config.mockAuthorizationServer;

    return {
      module: OAuthExampleModule,
      imports: [
        McpModule.forRoot({
          name: 'oauth',
          version: '1.0.0',
          auth: {
            strategies: [JwksJwtStrategy],
            // Listed but challenged: a client holding notes:read gets a 403
            // insufficient_scope step-up challenge on add_note.
            hideOutOfScope: false,
            protectedResource: {
              resource: config.resource,
              authorizationServers: [config.issuer],
              scopesSupported: SCOPES,
              resourceName: 'Notes (OAuth example)',
            },
          },
        }),
      ],
      controllers: mock ? [MockAuthorizationServerController] : [],
      providers: [
        { provide: OAUTH_EXAMPLE_CONFIG, useValue: config },
        ...(mock ? [MockAuthorizationServer] : []),
        JwksJwtStrategy,
        ForceUnauthorizedGuard,
        createNotesResolver(config),
      ],
    };
  }
}

@Module({
  imports: [
    OAuthExampleModule.forConfig(
      resolveOAuthConfig(process.env.BASE_URL ?? `http://localhost:${PORT}`),
    ),
  ],
})
export class AppModule {}
