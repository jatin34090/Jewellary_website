import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthCheck, HealthCheckService, type HealthCheckResult } from "@nestjs/terminus";
import type { AppPrismaClient } from "@jewellery/database";

import { Public } from "../../common/auth/auth.decorators";
import { PRISMA } from "../../prisma/prisma.module";
import { DatabaseHealthIndicator } from "./database.health";

@ApiTags("Health")
@SkipThrottle({ default: true })
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
  ) {}

  /** Liveness: the process is up. Does not touch dependencies, so a database blip cannot restart the container. */
  @Public()
  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  /** Readiness: the process can serve traffic (database reachable). Used by deploy health checks. */
  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Readiness probe, including database connectivity" })
  @ApiServiceUnavailableResponse({ description: "A dependency is unavailable" })
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.check(this.prisma)]);
  }
}
