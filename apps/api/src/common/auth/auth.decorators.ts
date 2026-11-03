import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedUser } from "./authenticated-user";
import type { UserRole } from "@jewellery/database";

export const IS_PUBLIC_KEY = "isPublic";
export const ROLES_KEY = "roles";

/** Marks a route as reachable without an access token. Everything else requires one. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to users holding at least one of the given roles. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user that JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
