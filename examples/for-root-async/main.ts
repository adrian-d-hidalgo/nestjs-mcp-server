import { NestFactory } from '@nestjs/core';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    await app.listen(Number(process.env.PORT ?? 3000));
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    console.log(
      `Async-import example server running on http://localhost:${port}/mcp`,
    );
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void bootstrap();
