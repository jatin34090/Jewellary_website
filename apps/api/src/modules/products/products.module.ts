import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { InventoryModule } from "../inventory/inventory.module";
import { AdminProductsController } from "./admin-products.controller";
import { AdminProductsService } from "./admin-products.service";
import { CatalogueService } from "./catalogue.service";
import { ProductsController } from "./products.controller";

@Module({
  imports: [AuditModule, InventoryModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [CatalogueService, AdminProductsService],
})
export class ProductsModule {}
