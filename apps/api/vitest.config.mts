import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    // The end-to-end suites hit the local PostgreSQL container, so allow for connection setup.
    testTimeout: 20_000,
    // Suites share one database. Running files one at a time keeps cleanup predictable.
    fileParallelism: false,
    // Refuses to start unless the test configuration points at a database named *_test.
    globalSetup: ["test/support/global-setup.ts"],
  },
});
