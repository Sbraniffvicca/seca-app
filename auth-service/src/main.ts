import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser()); // ✅ Enables reading cookies

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  //await app.listen(3001);
  await app.listen(3001, '0.0.0.0');

}
bootstrap();