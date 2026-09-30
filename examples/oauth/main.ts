import { NestFactory } from '@nestjs/core';

import { AppModule, PORT } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Browser-based clients (the MCP Inspector) run discovery, registration and
  // the token exchange cross-origin, and must read the 401 challenge.
  app.enableCors({ exposedHeaders: ['WWW-Authenticate'] });
  await app.listen(PORT);

  const base = process.env.BASE_URL ?? `http://localhost:${PORT}`;
  console.log(`OAuth example server running on ${base}`);
  console.log(`  MCP endpoint:        ${base}/mcp`);
  if (!process.env.OAUTH_ISSUER) {
    console.log(
      `  Mock AS (DEMO ONLY): ${base}/oauth — sign in as alice / alice-password or bob / bob-password`,
    );
  }
}

void bootstrap();
