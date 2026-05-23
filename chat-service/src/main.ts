import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser()); // ✅ Enables reading cookies

    // 🔥 Increase payload limit to 10MB (or higher if needed)
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.listen(config.port, '0.0.0.0');
}
bootstrap();
