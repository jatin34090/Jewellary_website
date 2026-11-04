import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Test-only configuration. It lives in apps/api/.env.test, which is git-ignored, and it points at a
 * dedicated database. The development .env is never read by the E2E suites.
 */
export const TEST_ENV_FILE = path.resolve(__dirname, "../../.env.test");

/** Keys that connect the app to outside services. Tests never carry real credentials for them. */
const EXTERNAL_KEYS = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
  "SHIPROCKET_PICKUP_LOCATION",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_UPLOAD_FOLDER",
];

/** Reads KEY=VALUE pairs from the test file. Does not touch process.env. */
export function readTestEnv(file: string = TEST_ENV_FILE): Record<string, string> {
  if (!existsSync(file)) {
    throw new Error(
      "apps/api/.env.test is missing. Create it with a dedicated test database (see the README).",
    );
  }
  const values: Record<string, string> = {};
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

/**
 * Refuses any database whose name does not end in _test. The error names the database but never
 * the URL, because the URL carries the password.
 */
export function assertTestDatabaseUrl(url: string | undefined): void {
  if (!url) {
    throw new Error("Refusing to run E2E tests: DATABASE_URL is not set for tests");
  }
  let name: string;
  try {
    name = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error("Refusing to run E2E tests: the test DATABASE_URL is not a valid URL");
  }
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run E2E tests: database "${name}" does not end in _test. Use the dedicated test database.`,
    );
  }
}

/**
 * Makes process.env describe the test database and nothing else. Values from .env.test replace
 * whatever the shell exported, external service keys are removed, and then the database name is
 * checked again on the effective value.
 */
export function applyTestEnv(overrides: Record<string, string> = {}): void {
  const values = { ...readTestEnv(), ...overrides };
  assertTestDatabaseUrl(values["DATABASE_URL"]);
  for (const key of EXTERNAL_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }
  Object.assign(process.env, values);
  assertTestDatabaseUrl(process.env["DATABASE_URL"]);
}
