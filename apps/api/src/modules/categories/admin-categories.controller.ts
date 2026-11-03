import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Category } from "@jewellery/database";

import { CurrentUser, Roles } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

@ApiTags("Admin: Categories")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/categories")
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: "Create a category" })
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Category> {
    return this.categories.create(dto, actor.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a category" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Category> {
    return this.categories.update(id, dto, actor.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a category (soft delete)" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.categories.remove(id, actor.id);
  }
}
