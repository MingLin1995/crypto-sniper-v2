import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  // JWT 密碼強度驗證
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const weakSecrets = [
      'your-secret-key-change-this-in-production',
      'your-refresh-secret-key-change-this-in-production',
    ];

    if (!jwtSecret || weakSecrets.includes(jwtSecret) || jwtSecret.length < 32) {
      throw new Error('生產環境必須更換 JWT_SECRET ！');
    }

    if (!jwtRefreshSecret || weakSecrets.includes(jwtRefreshSecret) || jwtRefreshSecret.length < 32) {
      throw new Error('生產環境必須更換 JWT_REFRESH_SECRET ！');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', true);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  // 是否啟用 CORS
  if (process.env.ENABLE_CORS === 'true') {
    const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [];
    const hasWildcard = corsOrigins.includes('*') || corsOrigins.length === 0;

    app.enableCors({
      origin: hasWildcard ? '*' : corsOrigins,
      credentials: !hasWildcard,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'], // x-line-userId
    });
  }

  // 全域驗證管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const config = new DocumentBuilder()
    .setTitle('NestJS Template API')
    .setDescription('時間格式一率使用 UTC+0，相關判斷由前後端各自處理')
    .setVersion(`v${packageJson.version}`)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  app.use(
    '/apidoc',
    apiReference({
      spec: {
        content: document,
      },
    }),
  );

  const port = process.env.PORT || 3000; // 對內 port
  const appPort = process.env.APP_PORT || 3000; // 對外 port

  await app.listen(port);

  console.info('');
  console.info('Application is ready');
  console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.info(`API URL:        http://localhost:${appPort}`);
  console.info(`API Docs:       http://localhost:${appPort}/apidoc (Scalar)`);
  console.info(`Version:        v${packageJson.version}`);
  console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.info('');
}

bootstrap();
