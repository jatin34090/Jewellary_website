import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/auth/auth.decorators";
import { CategoriesService, type CategoryNode } from "./categories.service";
import { CategoryNodeDto } from "./dto/category.dto";

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Browse the category tree" })
  @ApiOkResponse({ type: CategoryNodeDto, isArray: true })
  listTree(): Promise<CategoryNode[]> {
    return this.categories.listTree();
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "Get one visible category by slug" })
  async getBySlug(@Param("slug") slug: string) {
    const category = await this.categories.getVisibleBySlug(slug);
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
    };
  }
}
