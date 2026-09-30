import { NestFactory } from '@nestjs/core';
import { SignJWT } from 'jose';

import { AppModule } from './app.module';
import { ISSUER, JWT_SECRET, PORT, RESOURCE } from './auth.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(PORT);

  // A demo access token so the JWT strategy can be tried from the Inspector.
  const token = await new SignJWT({ scope: 'notes:read' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('demo-user')
    .setIssuer(ISSUER)
    .setAudience(RESOURCE)
    .setExpirationTime('1h')
    .sign(JWT_SECRET);

  console.log(`Auth example server running on http://localhost:${PORT}`);
  console.log('  x-api-key: demo-read-write-key   (notes:read notes:write)');
  console.log('  x-api-key: demo-read-only-key    (notes:read)');
  console.log(`  Authorization: Bearer ${token}`);
  console.log('  x-tenant: acme | acme-viewers    (narrows scopes)');
}

void bootstrap();
