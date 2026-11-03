/**
 * API base URL as the browser sees it, for example http://localhost:3001/api/v1.
 * Browser calls use this, so the refresh cookie (scoped to localhost) is sent back to the API.
 */
export const API_BASE_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

/**
 * Base URL used by server rendering. It can point at the API's internal address (for example
 * 127.0.0.1) when "localhost" does not resolve to the API from the Node process.
 */
export const SERVER_API_BASE_URL = process.env["API_INTERNAL_URL"] ?? API_BASE_URL;
