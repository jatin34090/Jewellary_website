import "reflect-metadata";

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createPrismaClient, type AppPrismaClient } from "@jewellery/database";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API_PREFIX, configureApp } from "../src/app.setup";
import { AppModule } from "../src/app.module";
import { loadEnv } from "../src/config/env";
import { applyTestEnv } from "./support/test-env";

const TEST_EMAIL_DOMAIN = "@example.com";
// Unique per run: every account this suite creates carries it, so cleanup removes only those.
const RUN = randomUUID().slice(0, 8);
const PASSWORD = "Correct-horse-1";

interface ApiBody<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: string[] };
}

interface AuthData {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string; role: string; passwordHash?: string };
}

let clientIpCounter = 0;

/** A unique IPv4 address per request, used as the rate-limit key through X-Forwarded-For. */
function nextClientIp(): string {
  clientIpCounter += 1;
  return `10.${Math.floor(clientIpCounter / 65536) % 256}.${Math.floor(clientIpCounter / 256) % 256}.${clientIpCounter % 256}`;
}

function uniqueEmail(): string {
  return `e2e-${RUN}-${randomUUID()}${TEST_EMAIL_DOMAIN}`;
}

function refreshCookie(setCookie: string[] | string | undefined): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.find((cookie) => cookie.startsWith("refresh_token="));
}

describe("Auth API", () => {
  let app: INestApplication;
  let prisma: AppPrismaClient;
  // Every request gets its own forwarded client IP, so each one has a fresh rate-limit bucket
  // and the per-IP limits on auth routes do not interfere with the other tests in this file.
  const api = () => ({
    get: (path: string) =>
      request(app.getHttpServer() as Server)
        .get(path)
        .set("X-Forwarded-For", nextClientIp()),
    post: (path: string) =>
      request(app.getHttpServer() as Server)
        .post(path)
        .set("X-Forwarded-For", nextClientIp()),
  });

  beforeAll(async () => {
    applyTestEnv();
    const env = { ...loadEnv(), trustProxy: 1 };
    prisma = createPrismaClient(env.databaseUrl, { maxConnections: 2 });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, env);
    await app.init();
  });

  afterAll(async () => {
    // Remove only the accounts this suite created. Refresh tokens cascade.
    await prisma.user.deleteMany({
      where: { email: { contains: RUN, endsWith: TEST_EMAIL_DOMAIN } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  it("reports database readiness on /health", async () => {
    const res = await api().get(`/${API_PREFIX}/health`).expect(200);
    expect(res.body).toMatchObject({ success: true, data: { status: "ok" } });
  });

  it("registers a customer, returns a token, and never exposes the password hash", async () => {
    const email = uniqueEmail();
    const res = await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email: `  ${email.toUpperCase()}  `, password: PASSWORD, firstName: "Asha" })
      .expect(201);

    const body = res.body as ApiBody<AuthData>;
    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBeTruthy();
    expect(body.data?.user.email).toBe(email); // normalised to lower case, trimmed
    expect(body.data?.user.role).toBe("CUSTOMER");
    expect(body.data?.user).not.toHaveProperty("passwordHash");

    const cookie = refreshCookie(res.headers["set-cookie"]);
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/v1/auth");
    expect(body.data).not.toHaveProperty("refreshToken");
  });

  it("rejects a duplicate email regardless of letter case", async () => {
    const email = uniqueEmail();
    await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email, password: PASSWORD, firstName: "First" })
      .expect(201);

    const res = await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email: email.toUpperCase(), password: PASSWORD, firstName: "Second" })
      .expect(409);
    expect((res.body as ApiBody<never>).error?.code).toBe("CONFLICT");
  });

  it("rejects weak passwords with field-level details", async () => {
    const res = await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email: uniqueEmail(), password: "short", firstName: "Asha", role: "ADMIN" })
      .expect(400);

    const error = (res.body as ApiBody<never>).error;
    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.details?.length).toBeGreaterThan(0);
  });

  it("ignores client-supplied role fields (mass assignment is blocked)", async () => {
    const res = await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email: uniqueEmail(), password: PASSWORD, firstName: "Asha", role: "ADMIN" })
      .expect(400);
    expect((res.body as ApiBody<never>).error?.details?.join(" ")).toContain("role");
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const email = uniqueEmail();
    await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email, password: PASSWORD, firstName: "Asha" })
      .expect(201);

    const wrongPassword = await api()
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password: "Wrong-password-1" })
      .expect(401);
    const unknownEmail = await api()
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(401);

    expect((wrongPassword.body as ApiBody<never>).error?.message).toBe(
      (unknownEmail.body as ApiBody<never>).error?.message,
    );
  });

  it("logs in, authenticates /users/me, and rejects a tampered token", async () => {
    const email = uniqueEmail();
    await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email, password: PASSWORD, firstName: "Asha" })
      .expect(201);

    const login = await api()
      .post(`/${API_PREFIX}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    const accessToken = (login.body as ApiBody<AuthData>).data?.accessToken ?? "";

    const me = await api()
      .get(`/${API_PREFIX}/users/me`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect((me.body as ApiBody<AuthData["user"]>).data?.email).toBe(email);

    const tampered = `${accessToken.slice(0, -2)}xx`;
    await api()
      .get(`/${API_PREFIX}/users/me`)
      .set("Authorization", `Bearer ${tampered}`)
      .expect(401);

    await api().get(`/${API_PREFIX}/users/me`).expect(401);
  });

  it("rotates the refresh token and revokes the whole session when an old token is replayed", async () => {
    const email = uniqueEmail();
    const register = await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email, password: PASSWORD, firstName: "Asha" })
      .expect(201);
    const firstCookie = refreshCookie(register.headers["set-cookie"]) ?? "";

    const refreshed = await api()
      .post(`/${API_PREFIX}/auth/refresh`)
      .set("Cookie", firstCookie)
      .expect(200);
    const secondCookie = refreshCookie(refreshed.headers["set-cookie"]) ?? "";
    expect(secondCookie).not.toBe(firstCookie);

    // Replaying the first token must fail, and it must also kill the rotated session.
    await api().post(`/${API_PREFIX}/auth/refresh`).set("Cookie", firstCookie).expect(401);
    await api().post(`/${API_PREFIX}/auth/refresh`).set("Cookie", secondCookie).expect(401);
  });

  it("revokes the refresh session on logout and is idempotent", async () => {
    const email = uniqueEmail();
    const register = await api()
      .post(`/${API_PREFIX}/auth/register`)
      .send({ email, password: PASSWORD, firstName: "Asha" })
      .expect(201);
    const cookie = refreshCookie(register.headers["set-cookie"]) ?? "";

    await api().post(`/${API_PREFIX}/auth/logout`).set("Cookie", cookie).expect(204);
    await api().post(`/${API_PREFIX}/auth/logout`).set("Cookie", cookie).expect(204);
    await api().post(`/${API_PREFIX}/auth/refresh`).set("Cookie", cookie).expect(401);
  });

  it("requires the refresh cookie for /auth/refresh", async () => {
    await api().post(`/${API_PREFIX}/auth/refresh`).expect(401);
  });
});
