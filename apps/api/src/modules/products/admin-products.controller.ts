import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { InventoryService, type InventoryView } from "../inventory/inventory.service";
import { AdjustInventoryDto } from "../inventory/dto/inventory.dto";
import { AdminProductsService, type AdminProductPage } from "./admin-products.service";
import { ListAdminProductsQueryDto } from "./dto/catalogue-query.dto";
import {
  AddProductImageDto,
  CreateProductDto,
  UpdateProductDto,
  UpdateProductImageDto,
} from "./dto/product.dto";
import type { AdminProductView } from "./product.views";

@ApiTags("Admin: Products")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/products")
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly inventory: InventoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List products, including drafts and archived items" })
  list(@Query() query: ListAdminProductsQueryDto): Promise<AdminProductPage> {
    return this.products.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one product with full stock figures" })
  get(@Param("id", ParseUUIDPipe) id: string): Promise<AdminProductView> {
    return this.products.get(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a product (with its inventory record)" })
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdminProductView> {
    return this.products.create(dto, actor.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update product details and category assignments" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdminProductView> {
    return this.products.update(id, dto, actor.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Archive and soft-delete a product" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.products.remove(id, actor.id);
  }

  @Post(":id/images")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Attach an uploaded image to a product" })
  addImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddProductImageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdminProductView> {
    return this.products.addImage(id, dto, actor.id);
  }

  @Patch(":id/images/:imageId")
  @ApiOperation({ summary: "Update image metadata, order or primary flag" })
  updateImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateProductImageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdminProductView> {
    return this.products.updateImage(id, imageId, dto, actor.id);
  }

  @Delete(":id/images/:imageId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Detach an image from a product" })
  removeImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.products.removeImage(id, imageId, actor.id);
  }

  @Get(":id/inventory")
  @ApiOperation({ summary: "Get stock levels for a product" })
  getInventory(@Param("id", ParseUUIDPipe) id: string): Promise<InventoryView> {
    return this.inventory.getForProduct(id);
  }

  @Patch(":id/inventory")
  @ApiOperation({ summary: "Set or adjust stock. Every change is written to the audit log." })
  adjustInventory(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<InventoryView> {
    return this.inventory.adjust(id, dto, actor.id);
  }
}
