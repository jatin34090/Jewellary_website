import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

const VALID = {
  DATABASE_URL: "postgresql://user:pass@127.0.0.1:5433/db",
  JWT_ACCESS_SECRET: "x".repeat(40),
};

describe("loadEnv", () => {
  it("applies safe defaults for local development", () => {
    const env = loadEnv({ ...VALID, NODE_ENV: "development" });

    expect(env.host).toBe("127.0.0.1");
    expect(env.port).toBe(3001);
    expect(env.cookieSecure).toBe(false);
    expect(env.swaggerEnabled).toBe(true);
    expect(env.accessTokenTtlSeconds).toBe(900);
    expect(env.corsOrigins).toEqual(["http://localhost:3000"]);
  });

  it("secures cookies and disables Swagger by default in production", () => {
    const env = loadEnv({ ...VALID, NODE_ENV: "production" });

    expect(env.cookieSecure).toBe(true);
    expect(env.swaggerEnabled).toBe(false);
  });

  it("rejects a short JWT secret", () => {
    expect(() => loadEnv({ ...VALID, JWT_ACCESS_SECRET: "too-short" })).toThrow(
      /JWT_ACCESS_SECRET must be at least 32 characters/,
    );
  });

  it("reports every missing or invalid value in one error", () => {
    let message = "";
    try {
      loadEnv({ API_PORT: "not-a-number", NODE_ENV: "staging" });
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).toContain("DATABASE_URL is required");
    expect(message).toContain("JWT_ACCESS_SECRET is required");
    expect(message).toContain("API_PORT must be");
    expect(message).toContain("NODE_ENV must be");
  });

  it("parses a comma-separated list of CORS origins", () => {
    const env = loadEnv({
      ...VALID,
      CORS_ORIGINS: " https://shop.example.com , http://localhost:3000 ,",
    });

    expect(env.corsOrigins).toEqual(["https://shop.example.com", "http://localhost:3000"]);
  });
});
