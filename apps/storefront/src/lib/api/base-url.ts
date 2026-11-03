/**
 * API base URL, for example http://127.0.0.1:3001/api/v1. Set NEXT_PUBLIC_API_URL in the environment.
 * Server components read the same value, so one variable covers both the server and the browser.
 */
export const API_BASE_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://127.0.0.1:3001/api/v1";
