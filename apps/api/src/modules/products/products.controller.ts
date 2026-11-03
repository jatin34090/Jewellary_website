import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

import { Public } from "../../common/auth/auth.decorators";
import type { CursorPage } from "../../common/pagination/cursor";
import { CatalogueService } from "./catalogue.service";
import { ListProductsQueryDto } from "./dto/catalogue-query.dto";
import type { PublicProductDetail, PublicProductSummary } from "./product.views";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({
    summary: "Search and browse products",
    description:
      "Filter by category, price range, featured flag or full-text query. Sort and paginate with the returned nextCursor.",
  })
  @ApiOkResponse({
    description: "A page of product summaries with an opaque nextCursor (null on the last page).",
  })
  list(@Query() query: ListProductsQueryDto): Promise<CursorPage<PublicProductSummary>> {
    return this.catalogue.list(query);
  }

  @Public()
  @Get(":slug")
  @SkipThrottle({ default: true })
  @ApiOperation({ summary: "Get one product with images, categories and related items" })
  getBySlug(@Param("slug") slug: string): Promise<PublicProductDetail> {
    return this.catalogue.getBySlug(slug);
  }
}
