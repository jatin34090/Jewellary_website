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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Address } from "@jewellery/database";

import { CurrentUser } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";
import { AddressesService } from "./addresses.service";

@ApiTags("Addresses")
@ApiBearerAuth()
@Controller("addresses")
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List the signed-in customer's addresses" })
  list(@CurrentUser() user: AuthenticatedUser): Promise<Address[]> {
    return this.addresses.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: "Save a new address" })
  create(@Body() dto: CreateAddressDto, @CurrentUser() user: AuthenticatedUser): Promise<Address> {
    return this.addresses.create(user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an address" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Address> {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an address" })
  remove(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
