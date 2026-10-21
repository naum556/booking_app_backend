import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS is opt-in and disabled by default, so existing same-origin/proxy
  // setups keep working unchanged. Set CORS_ORIGIN to a comma-separated list
  // of allowed origins (e.g. "https://my-app.netlify.app") when a browser
  // needs to call this API cross-origin.
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    });
  }

  // PORT is injected by the host (Render sets it explicitly); 3000 is the
  // local-dev fallback.
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
