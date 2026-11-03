import type { UserRole } from "@jewellery/database";

/** The identity attached to a request after its access token has been verified. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

/** Claims carried inside an access token. Kept small on purpose: it is sent on every request. */
export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
}
