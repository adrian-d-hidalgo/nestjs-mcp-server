import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('Dynamic capabilities example running on http://localhost:3000');
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
