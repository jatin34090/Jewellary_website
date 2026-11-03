import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AdminCategoriesController } from "./admin-categories.controller";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";

@Module({
  imports: [AuditModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
