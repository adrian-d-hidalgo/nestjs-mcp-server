import { Module } from '@nestjs/common';

import { McpModule } from '../../src';
import { ApiKeyStrategy } from './api-key.strategy';
import { ISSUER, RESOURCE } from './auth.constants';
import { JwtStrategy } from './jwt.strategy';
import { NotesResolver } from './notes.resolver';
import { TenantAuthorizer } from './tenant.authorizer';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'auth',
      version: '1.0.0',
      auth: {
        // Tried in order; the first to return an AuthInfo wins.
        strategies: [ApiKeyStrategy, JwtStrategy],
        authorizers: [TenantAuthorizer],
        // A tenant narrowing is not something re-consent can fix, so
        // out-of-scope tools are hidden rather than challenged.
        hideOutOfScope: true,
        protectedResource: {
          resource: RESOURCE,
          authorizationServers: [ISSUER],
          scopesSupported: ['notes:read', 'notes:write'],
          resourceName: 'Notes (auth example)',
        },
      },
    }),
  ],
  providers: [ApiKeyStrategy, JwtStrategy, TenantAuthorizer, NotesResolver],
})
export class AppModule {}
