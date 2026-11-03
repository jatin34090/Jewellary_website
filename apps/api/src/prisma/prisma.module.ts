import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { createPrismaClient, type AppPrismaClient } from "@jewellery/database";

import { ENV } from "../config/config.module";
import type { Env } from "../config/env";

export const PRISMA = Symbol("PRISMA");

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      inject: [ENV],
      useFactory: (env: Env): AppPrismaClient => createPrismaClient(env.databaseUrl),
    },
  ],
  exports: [PRISMA],
})
export class PrismaModule implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
