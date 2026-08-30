import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { StructuredLogger } from "./common/logging/structured-logger.service";
import {
  requestIdMiddleware,
  requestObservabilityMiddleware,
} from "./common/middleware/request-id.middleware";

async function bootstrap() {
  const logger = new StructuredLogger("Bootstrap");
  const app = await NestFactory.create(AppModule, { logger });
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>("app.prefix", "api/v1");
  const port = configService.get<number>("app.port", 3000);
  const corsOrigins = configService.get<string | undefined>(
    "security.corsOrigins",
  );

  app.setGlobalPrefix(apiPrefix, {
    exclude: ["health"],
  });
  app.use(requestIdMiddleware);
  app.use(
    requestObservabilityMiddleware({
      environment: configService.get<string>("app.environment"),
    }),
  );
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-frame-options", "DENY");
    response.setHeader("referrer-policy", "no-referrer");
    response.setHeader("x-permitted-cross-domain-policies", "none");
    next();
  });
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(",").map((origin) => origin.trim())
      : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new GlobalExceptionFilter(configService.get<string>("app.environment")),
  );

  if (configService.get<boolean>("swagger.enabled", true)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Balcona Bar API")
      .setDescription("Backend API for the Cafe AI Waiter App foundation")
      .setVersion(configService.get<string>("app.version", "0.1.0"))
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup("api/docs", app, document, {
      jsonDocumentUrl: "api/openapi.json",
    });
  }

  await app.listen(port);
  logger.log({ message: "API listening", port, apiPrefix });
}

void bootstrap();
