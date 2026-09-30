import { ConsoleLogger, type LogLevel } from '@nestjs/common';

/** Nest's levels, most verbose first. */
const LEVELS: LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

/**
 * The `logger` option for every e2e app: silent by default, so the suite's
 * deliberate failures (throwing gates, rejected guards) do not flood the run.
 *
 * `E2E_LOG_LEVEL=debug pnpm test:e2e` prints that level and above.
 *
 * It has to go through `createNestApplication`: `Test…compile()` installs
 * Nest's `TestingLogger`, so a global override set earlier would not survive.
 * A `ConsoleLogger` rather than a level list: a list only re-levels the
 * installed `TestingLogger`, whose non-error methods print nothing.
 */
export function e2eLogger(): ConsoleLogger | false {
  const level = process.env.E2E_LOG_LEVEL as LogLevel | undefined;
  if (!level) return false;

  const index = LEVELS.indexOf(level);
  if (index === -1) {
    throw new Error(
      `E2E_LOG_LEVEL must be one of ${LEVELS.join(', ')}; got "${level}".`,
    );
  }

  return new ConsoleLogger({ logLevels: LEVELS.slice(index) });
}
