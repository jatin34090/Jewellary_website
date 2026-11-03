import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { ROLES_KEY } from "./auth.decorators";
import { RolesGuard } from "./roles.guard";

function contextFor(
  user: { id: string; role: "CUSTOMER" | "ADMIN" } | undefined,
): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: (key: string) => (key === ROLES_KEY ? roles : undefined),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows any signed-in user when a route declares no roles", () => {
    const guard = guardRequiring(undefined);
    expect(guard.canActivate(contextFor({ id: "u1", role: "CUSTOMER" }))).toBe(true);
  });

  it("allows a user whose role is listed", () => {
    const guard = guardRequiring(["ADMIN"]);
    expect(guard.canActivate(contextFor({ id: "u1", role: "ADMIN" }))).toBe(true);
  });

  it("forbids a customer on an admin-only route", () => {
    const guard = guardRequiring(["ADMIN"]);
    expect(() => guard.canActivate(contextFor({ id: "u1", role: "CUSTOMER" }))).toThrow(
      ForbiddenException,
    );
  });

  it("forbids an unauthenticated request on a role-protected route", () => {
    const guard = guardRequiring(["ADMIN"]);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
