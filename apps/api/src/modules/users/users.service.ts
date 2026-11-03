import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type AppPrismaClient, type User, type UserRole } from "@jewellery/database";

import { PRISMA } from "../../prisma/prisma.module";

/** The only shape of a user that leaves the server. Never includes passwordHash or deletedAt. */
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName?: string | undefined;
  phone?: string | undefined;
}

export function toPublicUser(
  user: Pick<User, "id" | "email" | "firstName" | "lastName" | "phone" | "role" | "createdAt">,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    return user ? toPublicUser(user) : null;
  }

  findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
      },
    });
  }

  async recordLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  /** True when the error is a Prisma unique-constraint violation (P2002), e.g. a duplicate email. */
  static isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
