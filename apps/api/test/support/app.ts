import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createPrismaClient, type AppPrismaClient } from "@jewellery/database";
import request, { type Test as SupertestRequest } from "supertest";
import type { Server } from "node:http";

import { API_PREFIX, configureApp } from "../../src/app.setup";
import { AppModule } from "../../src/app.module";
import { PAYMENT_GATEWAY, type PaymentGateway } from "../../src/modules/payments/razorpay.client";
import { loadDotEnvFile, loadEnv } from "../../src/config/env";

export const API = `/${API_PREFIX}`;

export interface TestContext {
  app: INestApplication;
  prisma: AppPrismaClient;
  http: TestHttp;
}

export interface ApiBody<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: string[] };
}

/**
 * Boots the full application with the same HTTP configuration as production.
 * `trustProxy` is set so tests can give each request its own forwarded IP (see TestHttp).
 */
export interface TestContextOptions {
  /** Replaces the Razorpay gateway. Tests use this so no real payment call is made. */
  gateway?: PaymentGateway;
}

export async function createTestContext(options: TestContextOptions = {}): Promise<TestContext> {
  loadDotEnvFile();
  const env = { ...loadEnv(), trustProxy: 1 };
  const prisma = createPrismaClient(env.databaseUrl, { maxConnections: 2 });

  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.gateway) {
    builder = builder.overrideProvider(PAYMENT_GATEWAY).useValue(options.gateway);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app, env);
  await app.init();

  return { app, prisma, http: createTestHttp(app) };
}

let clientIpCounter = 0;

/** A unique IPv4 per request. Rate limits are keyed by IP, so each request gets a fresh bucket. */
export function nextClientIp(): string {
  clientIpCounter += 1;
  const n = clientIpCounter;
  return `10.${Math.floor(n / 65536) % 256}.${Math.floor(n / 256) % 256}.${n % 256}`;
}

export interface TestHttp {
  get(path: string, token?: string): SupertestRequest;
  post(path: string, body?: unknown, token?: string): SupertestRequest;
  patch(path: string, body?: unknown, token?: string): SupertestRequest;
  delete(path: string, token?: string): SupertestRequest;
}

function createTestHttp(app: INestApplication): TestHttp {
  const server = (): Server => app.getHttpServer() as Server;

  const authorise = (req: SupertestRequest, token?: string): SupertestRequest =>
    token ? req.set("Authorization", `Bearer ${token}`) : req;

  return {
    get: (path, token) =>
      authorise(request(server()).get(path).set("X-Forwarded-For", nextClientIp()), token),
    post: (path, body, token) =>
      authorise(
        request(server())
          .post(path)
          .set("X-Forwarded-For", nextClientIp())
          .send(body ?? {}),
        token,
      ),
    patch: (path, body, token) =>
      authorise(
        request(server())
          .patch(path)
          .set("X-Forwarded-For", nextClientIp())
          .send(body ?? {}),
        token,
      ),
    delete: (path, token) =>
      authorise(request(server()).delete(path).set("X-Forwarded-For", nextClientIp()), token),
  };
}
