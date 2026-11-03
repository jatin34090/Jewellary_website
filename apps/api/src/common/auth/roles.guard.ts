import {
  Injectable,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@jewellery/database";

import { ROLES_KEY } from "./auth.decorators";
import type { AuthenticatedUser } from "./authenticated-user";

/** Runs after JwtAuthGuard. Enforces @Roles() when present; routes without it are open to any signed-in user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }
    return true;
  }
}
