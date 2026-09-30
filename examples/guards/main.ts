import { NestFactory } from '@nestjs/core';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT ?? 3000));
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  console.log(`Guards example server running on http://localhost:${port}/mcp`);
}

void bootstrap();
