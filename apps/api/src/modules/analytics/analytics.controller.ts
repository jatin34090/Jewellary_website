import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";

import { Roles } from "../../common/auth/auth.decorators";
import { CATALOGUE_ROLES } from "../../common/auth/roles.constants";
import { AnalyticsService, type AnalyticsView } from "./analytics.service";

export const ANALYTICS_RANGES = [7, 30, 90] as const;

class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_RANGES, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(ANALYTICS_RANGES)
  days?: (typeof ANALYTICS_RANGES)[number];
}

@ApiTags("Admin: Analytics")
@ApiBearerAuth()
@Roles(...CATALOGUE_ROLES)
@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: "Sales over the last 7, 30 or 90 days: daily totals, top products and order statuses",
  })
  overview(@Query() query: AnalyticsQueryDto): Promise<AnalyticsView> {
    return this.analytics.overview(query.days ?? 30);
  }
}
