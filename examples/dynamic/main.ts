import { NestFactory } from '@nestjs/core';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT ?? 3000));
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  console.log(
    `Dynamic capabilities example running on http://localhost:${port}/mcp`,
  );
  console.log(
    'Connect with header "x-role: admin" to see admin_only_tool, ' +
      'admin_only_prompt and admin_only_resource appear in their lists.',
  );
  console.log(
    'Without it, AdminGate consults PermissionsService through DI and answers ' +
      'false. The throwing, rejecting and unresolvable gates always fail closed.',
  );
}

void bootstrap();
