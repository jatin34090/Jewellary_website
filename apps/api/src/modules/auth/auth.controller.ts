import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { Public } from "../../common/auth/auth.decorators";
import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { AuthService, type AuthSession } from "./auth.service";
import { AuthResponseDto, LoginDto, RegisterDto } from "./dto/auth.dto";
import type { ClientMeta } from "./token.service";

export const REFRESH_COOKIE = "refresh_token";
/** The refresh cookie is only sent to auth routes, never to the rest of the API. */
const REFRESH_COOKIE_PATH = "/api/v1/auth";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Create a customer account and sign in" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: "Email already registered" })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded" })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.register(dto, clientMeta(req));
    return this.respondWithSession(session, res);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded" })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.login(dto, clientMeta(req));
    return this.respondWithSession(session, res);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ default: true })
  @ApiOperation({
    summary: "Issue a new access token using the refresh cookie (rotates the refresh token)",
  })
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Refresh session is missing, expired or revoked" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const raw = readRefreshCookie(req);
    if (!raw) {
      throw new UnauthorizedException("Session is invalid. Please sign in again.");
    }
    const session = await this.auth.refresh(raw, clientMeta(req));
    return this.respondWithSession(session, res);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SkipThrottle({ default: true })
  @ApiOperation({ summary: "Revoke the current refresh session and clear the cookie" })
  @ApiCookieAuth(REFRESH_COOKIE)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
  }

  private respondWithSession(session: AuthSession, res: Response): AuthResponseDto {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.refreshCookieOptions(),
      maxAge: this.env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    });
    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
      user: session.user,
    };
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.env.cookieSecure,
      sameSite: "strict" as const,
      path: REFRESH_COOKIE_PATH,
    };
  }
}

function clientMeta(req: Request): ClientMeta {
  return {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };
}

function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
