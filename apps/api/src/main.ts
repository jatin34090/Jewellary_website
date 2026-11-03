import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { API_PREFIX, SWAGGER_PATH, configureApp, setupSwagger } from "./app.setup";
import { AppModule } from "./app.module";
import { loadDotEnvFile, loadEnv } from "./config/env";

const logger = new Logger("Bootstrap");

async function bootstrap(): Promise<void> {
  loadDotEnvFile();
  const env = loadEnv();

  // rawBody keeps the unparsed request body, which webhook signature checks need.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app, env);

  if (env.swaggerEnabled) {
    setupSwagger(app);
  }

  await app.listen(env.port, env.host);
  logger.log(`API listening on http://${env.host}:${env.port}/${API_PREFIX}`);
  if (env.swaggerEnabled) {
    logger.log(`Swagger docs at http://${env.host}:${env.port}/${SWAGGER_PATH}`);
  }
}

bootstrap().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
