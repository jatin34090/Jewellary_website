import { Global, Module } from "@nestjs/common";

import { loadEnv, type Env } from "./env";
import { loadIntegrations, type Integrations } from "./integrations";

export const ENV = Symbol("ENV");
export const INTEGRATIONS = Symbol("INTEGRATIONS");

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => loadEnv(),
    },
    {
      provide: INTEGRATIONS,
      useFactory: (): Integrations => loadIntegrations(),
    },
  ],
  exports: [ENV, INTEGRATIONS],
})
export class ConfigModule {}
