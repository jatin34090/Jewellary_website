import { Injectable } from "@nestjs/common";
import { HealthIndicatorService, type HealthIndicatorResult } from "@nestjs/terminus";
import type { AppPrismaClient } from "@jewellery/database";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly indicators: HealthIndicatorService) {}

  async check(prisma: AppPrismaClient, key = "database"): Promise<HealthIndicatorResult> {
    const indicator = this.indicators.check(key);
    try {
      await prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch {
      // Do not include the driver error: it can contain connection details.
      return indicator.down({ message: "Database is unreachable" });
    }
  }
}
