import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AppPrismaClient, UserRole } from "@jewellery/database";

import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { PRISMA } from "../../prisma/prisma.module";
import type { AccessTokenClaims } from "../../common/auth/authenticated-user";

export interface ClientMeta {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export interface IssuedRefreshToken {
  userId: string;
  rawToken: string;
}

/** SHA-256 of a refresh token. Only this hash is stored, so a database leak cannot replay sessions. */
export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.env.accessTokenTtlSeconds;
  }

  signAccessToken(userId: string, role: UserRole): Promise<string> {
    const claims: AccessTokenClaims = { sub: userId, role };
    return this.jwt.signAsync(claims, {
      secret: this.env.jwtAccessSecret,
      algorithm: "HS256",
      expiresIn: this.env.accessTokenTtlSeconds,
    });
  }

  /** Creates a new refresh token row and returns the raw value, which is only ever sent to the client. */
  async createRefreshToken(userId: string, meta: ClientMeta): Promise<string> {
    const rawToken = generateRawToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashRefreshToken(rawToken),
        expiresAt: this.refreshExpiry(),
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        ipAddress: meta.ipAddress?.slice(0, 45) ?? null,
      },
    });
    return rawToken;
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one is issued.
   * Presenting an already-revoked token means it was copied or replayed, so every session
   * for that user is revoked and the caller must sign in again.
   */
  async rotateRefreshToken(rawToken: string, meta: ClientMeta): Promise<IssuedRefreshToken> {
    const tokenHash = hashRefreshToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedException("Session is invalid. Please sign in again.");
    }
    if (existing.revokedAt) {
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException("Session is invalid. Please sign in again.");
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session has expired. Please sign in again.");
    }

    const newRawToken = generateRawToken();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: existing.userId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!user) {
        throw new UnauthorizedException("Account is not available");
      }

      // Claim the old token atomically. If a concurrent request already claimed it, count is 0.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException("Session is invalid. Please sign in again.");
      }

      const replacement = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: hashRefreshToken(newRawToken),
          expiresAt: this.refreshExpiry(),
          userAgent: meta.userAgent?.slice(0, 255) ?? null,
          ipAddress: meta.ipAddress?.slice(0, 45) ?? null,
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { replacedById: replacement.id },
      });

      return { userId: existing.userId, rawToken: newRawToken };
    });
  }

  /** Revokes one refresh token. Unknown or already-revoked tokens are ignored, so logout is idempotent. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  refreshTokenTtlSeconds(): number {
    return this.env.refreshTokenTtlDays * 24 * 60 * 60;
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTokenTtlSeconds() * 1000);
  }
}

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}
