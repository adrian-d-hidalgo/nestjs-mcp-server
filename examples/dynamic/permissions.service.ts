import { Injectable } from '@nestjs/common';

/**
 * Stands in for whatever a real deployment asks: a database, an entitlements
 * API, a feature-flag service.
 *
 * A gate is resolved from the Nest container, so it can inject this. That is
 * the whole point of the gate being a class: a bare lambda evaluated at
 * class-definition time could never reach it.
 *
 * It is deliberately `async` — the answer arrives on a later tick, exactly as a
 * real lookup would.
 */
@Injectable()
export class PermissionsService {
  private readonly adminClients = new Set(['admin-client']);

  /** Simulates the latency of a real lookup, on the connect path. */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async isAdmin(role?: string, clientId?: string): Promise<boolean> {
    await PermissionsService.delay(10);

    console.log(
      `[PermissionsService] consulted for role=${role ?? 'none'} clientId=${clientId ?? 'none'}`,
    );

    return role === 'admin' || (!!clientId && this.adminClients.has(clientId));
  }

  /** A slow answer, to show that gates settle in one wave, not N round-trips. */
  async isBetaEnabled(): Promise<boolean> {
    await PermissionsService.delay(100);

    return true;
  }
}
