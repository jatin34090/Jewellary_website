import { Controller, Get, NotFoundException } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import { PublicUserDto } from "./dto/public-user.dto";
import { UsersService, type PublicUser } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get the signed-in user's profile" })
  @ApiOkResponse({ type: PublicUserDto })
  async me(@CurrentUser() current: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.users.findPublicById(current.id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
