import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser()); // ✅ Enables reading cookies

  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.listen(config.port, '0.0.0.0');

}
bootstrap();
