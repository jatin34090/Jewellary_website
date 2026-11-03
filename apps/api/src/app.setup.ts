import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import type { Env } from "./config/env";

export const API_PREFIX = "api/v1";
export const SWAGGER_PATH = `${API_PREFIX}/docs`;

/**
 * Applies the HTTP-level configuration shared by the real server and the test suite,
 * so tests exercise the same pipeline as production.
 */
export function configureApp(app: NestExpressApplication, env: Env): void {
  app.set("trust proxy", env.trustProxy);

  // Swagger UI loads inline scripts, which the strict default CSP blocks. Only relax it when docs are on.
  app.use(env.swaggerEnabled ? helmet({ contentSecurityPolicy: false }) : helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableShutdownHooks();
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Jewellery E-commerce API")
    .setDescription("REST API for the jewellery storefront and admin dashboard.")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addCookieAuth("refresh_token")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${API_PREFIX}/docs-json`,
  });
}
