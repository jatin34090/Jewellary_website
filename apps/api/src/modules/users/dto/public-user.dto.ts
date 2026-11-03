import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@jewellery/database";

/** Documentation shape for a user returned by the API. */
export class PublicUserDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  phone!: string | null;

  @ApiProperty({ enum: UserRole, enumName: "UserRole" })
  role!: UserRole;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: Date;
}
