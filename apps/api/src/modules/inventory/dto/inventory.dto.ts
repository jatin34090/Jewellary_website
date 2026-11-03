import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsString, Length, Max, Min } from "class-validator";

export const INVENTORY_MODES = ["SET", "ADJUST"] as const;
export type InventoryMode = (typeof INVENTORY_MODES)[number];

export class AdjustInventoryDto {
  @ApiProperty({
    enum: INVENTORY_MODES,
    description: "SET replaces the on-hand quantity. ADJUST adds a signed delta.",
  })
  @IsIn(INVENTORY_MODES)
  mode!: InventoryMode;

  @ApiProperty({ example: 5, description: "Target quantity for SET, signed change for ADJUST." })
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  quantity!: number;

  @ApiProperty({ example: "Restocked from supplier invoice 1042", minLength: 3, maxLength: 200 })
  @IsString()
  @Length(3, 200)
  reason!: string;
}
