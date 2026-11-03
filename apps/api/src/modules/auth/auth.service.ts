import { randomBytes } from "node:crypto";

import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { User } from "@jewellery/database";

import { toPublicUser, UsersService, type PublicUser } from "../users/users.service";
import { hashPassword, verifyPassword } from "./password";
import { TokenService, type ClientMeta } from "./token.service";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";

export interface AuthSession {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PublicUser;
  /** Returned to the controller, which sends it as an HttpOnly cookie. It never appears in the JSON body. */
  refreshToken: string;
}

const INVALID_CREDENTIALS = "Invalid email or password";

@Injectable()
export class AuthService {
  // Hash of a random value, computed once. Used to spend the same CPU time on unknown
  // emails as on real ones, so response timing does not reveal which accounts exist.
  private readonly unknownUserHash = hashPassword(randomBytes(24).toString("hex"));

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto, meta: ClientMeta): Promise<AuthSession> {
    const email = dto.email;
    if (await this.users.findByEmail(email)) {
      throw new ConflictException("An account with this email already exists");
    }

    let user: User;
    try {
      user = await this.users.create({
        email,
        passwordHash: await hashPassword(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      });
    } catch (error) {
      // Two concurrent registrations can pass the check above. The unique index decides the winner.
      if (UsersService.isUniqueViolation(error)) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }

    return this.startSession(user, meta);
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthSession> {
    const user = await this.users.findByEmail(dto.email);

    if (!user || !user.isActive) {
      await verifyPassword(await this.unknownUserHash, dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await verifyPassword(user.passwordHash, dto.password);
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.users.recordLogin(user.id);
    return this.startSession(user, meta);
  }

  /** Exchanges a refresh token for a new access token and a rotated refresh token. */
  async refresh(rawRefreshToken: string, meta: ClientMeta): Promise<AuthSession> {
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken, meta);
    const user = await this.users.findActiveById(rotated.userId);
    if (!user) {
      throw new UnauthorizedException("Account is not available");
    }

    const accessToken = await this.tokens.signAccessToken(user.id, user.role);
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.tokens.accessTokenTtlSeconds,
      user: toPublicUser(user),
      refreshToken: rotated.rawToken,
    };
  }

  /** Revokes the presented refresh token. Safe to call without a token or with an unknown one. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      await this.tokens.revokeRefreshToken(rawRefreshToken);
    }
  }

  private async startSession(user: User, meta: ClientMeta): Promise<AuthSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken(user.id, user.role),
      this.tokens.createRefreshToken(user.id, meta),
    ]);

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.tokens.accessTokenTtlSeconds,
      user: toPublicUser(user),
      refreshToken,
    };
  }
}
