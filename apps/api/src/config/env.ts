import { existsSync } from "node:fs";
import * as path from "node:path";

export interface Env {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  cookieSecure: boolean;
  swaggerEnabled: boolean;
  trustProxy: number;
}

const NODE_ENVS = ["development", "test", "production"] as const;

/**
 * Loads the repo-root .env for local development. In production the variables are
 * injected by the container runtime, so the file is absent and this is a no-op.
 * Variables that are already set in the environment take precedence.
 */
export function loadDotEnvFile(): void {
  const file = path.resolve(__dirname, "../../../../.env");
  if (existsSync(file)) {
    process.loadEnvFile(file);
  }
}

/**
 * Reads and validates environment variables. Fails fast with every problem listed at once,
 * so a misconfigured deployment never starts half-working.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const problems: string[] = [];

  const requireValue = (name: string): string => {
    const value = source[name]?.trim();
    if (!value) {
      problems.push(`${name} is required`);
      return "";
    }
    return value;
  };

  const readInt = (name: string, fallback: number, min: number, max: number): number => {
    const raw = source[name]?.trim();
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      problems.push(`${name} must be an integer between ${min} and ${max}`);
      return fallback;
    }
    return value;
  };

  const readBool = (name: string, fallback: boolean): boolean => {
    const raw = source[name]?.trim().toLowerCase();
    if (raw === undefined || raw === "") return fallback;
    if (raw === "true") return true;
    if (raw === "false") return false;
    problems.push(`${name} must be "true" or "false"`);
    return fallback;
  };

  const nodeEnvRaw = source["NODE_ENV"]?.trim() || "development";
  if (!(NODE_ENVS as readonly string[]).includes(nodeEnvRaw)) {
    problems.push(`NODE_ENV must be one of: ${NODE_ENVS.join(", ")}`);
  }
  const nodeEnv = nodeEnvRaw as Env["nodeEnv"];

  const jwtAccessSecret = requireValue("JWT_ACCESS_SECRET");
  if (jwtAccessSecret && jwtAccessSecret.length < 32) {
    problems.push("JWT_ACCESS_SECRET must be at least 32 characters");
  }

  const corsOrigins = (source["CORS_ORIGINS"] ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const env: Env = {
    nodeEnv,
    // Loopback by default. The Docker image sets API_HOST=0.0.0.0 so the published port works.
    host: source["API_HOST"]?.trim() || "127.0.0.1",
    port: readInt("API_PORT", 3001, 1, 65535),
    databaseUrl: requireValue("DATABASE_URL"),
    corsOrigins,
    jwtAccessSecret,
    accessTokenTtlSeconds: readInt("ACCESS_TOKEN_TTL_SECONDS", 900, 60, 3600),
    refreshTokenTtlDays: readInt("REFRESH_TOKEN_TTL_DAYS", 30, 1, 90),
    cookieSecure: readBool("COOKIE_SECURE", nodeEnv === "production"),
    swaggerEnabled: readBool("SWAGGER_ENABLED", nodeEnv !== "production"),
    trustProxy: readInt("TRUST_PROXY_HOPS", 0, 0, 5),
  };

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join("\n - ")}`);
  }
  return env;
}
