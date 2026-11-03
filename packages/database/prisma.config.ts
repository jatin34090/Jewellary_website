import * as path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma CLI does not read the repo-root .env by itself, so load it here.
// Existing environment variables always win over the file.
try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"));
} catch {
  // No .env file (for example in CI, where variables are injected). Continue.
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma", "migrations"),
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
