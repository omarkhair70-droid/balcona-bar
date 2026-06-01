import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { StructuredLogger } from './common/logging/structured-logger.service';

async function bootstrap() {
  const logger = new StructuredLogger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger });
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('app.prefix', 'api/v1');
  const port = configService.get<number>('app.port', 3000);

  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(port);
  logger.log({ message: 'API listening', port, apiPrefix });
}

void bootstrap();
