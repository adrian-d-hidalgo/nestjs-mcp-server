import { Module } from '@nestjs/common';

import { McpModule } from '../../src/mcp.module';
import {
  AdminGate,
  BetaGate,
  RejectingGate,
  ThrowingGate,
} from './capability.gates';
import { DynamicResolver } from './dynamic.resolver';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [
    McpModule.forRoot({
      name: 'dynamic',
      version: '1.0.0',
      logging: {
        enabled: true,
        level: 'verbose',
      },
    }),
  ],
  providers: [
    // Gates are ordinary providers, resolved through the container exactly as
    // guards are — which is what lets them inject `PermissionsService`.
    PermissionsService,
    AdminGate,
    BetaGate,
    RejectingGate,
    ThrowingGate,
    // `UnresolvableGate` is deliberately absent: it demonstrates the
    // fail-closed path for a gate the container cannot build.
    DynamicResolver,
  ],
})
export class AppModule {}
