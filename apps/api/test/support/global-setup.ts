import { applyTestEnv } from "./test-env";

/**
 * Runs once before any test file. If the test configuration points at anything other than a
 * database named *_test, the whole run stops here, before a single row is written.
 */
export default function setup(): void {
  applyTestEnv();
}
