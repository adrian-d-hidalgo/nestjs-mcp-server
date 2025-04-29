import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
    console.log('Async-import example server running on http://localhost:3000');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void bootstrap();
