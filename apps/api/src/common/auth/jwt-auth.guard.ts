import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { IS_PUBLIC_KEY } from "./auth.decorators";
import type { AccessTokenClaims, AuthenticatedUser } from "./authenticated-user";

/**
 * Global guard: every route needs a valid access token unless marked @Public().
 * Verifies the bearer token and attaches `request.user`. It does not hit the database,
 * so the check is cheap. Access tokens are short-lived for this reason.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.env.jwtAccessSecret,
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException("Access token is invalid or expired");
    }

    request.user = { id: claims.sub, role: claims.role };
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}
