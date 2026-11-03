import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  BadRequestException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser, Public } from "../../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../../common/auth/authenticated-user";
import type { OrderView } from "../orders/order.presenter";
import {
  IDEMPOTENCY_KEY_PATTERN,
  CheckoutQuoteDto,
  CreateCheckoutOrderDto,
  VerifyPaymentDto,
} from "./dto/checkout.dto";
import { CheckoutService, type CheckoutOrderView, type QuoteView } from "./checkout.service";

@ApiTags("Checkout")
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Public()
  @Post("quote")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: "Price a bag: totals, coupon result and stock issues",
    description:
      "Prices are computed on the server from the catalogue. Client-side prices are never used.",
  })
  quote(@Body() dto: CheckoutQuoteDto): Promise<QuoteView> {
    return this.checkout.quote(dto);
  }

  @ApiBearerAuth()
  @Post("orders")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    description: "8-64 characters, unique per checkout attempt.",
  })
  @ApiOperation({
    summary: "Place an order and reserve its stock. Returns the Razorpay details for payment.",
  })
  createOrder(
    @Body() dto: CreateCheckoutOrderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CheckoutOrderView> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException("A valid Idempotency-Key header (8-64 characters) is required");
    }
    return this.checkout.createOrder(user.id, dto, idempotencyKey);
  }

  @ApiBearerAuth()
  @Post("payments/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Verify the payment signature from Razorpay Checkout and confirm the order",
  })
  verify(
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderView> {
    return this.checkout.verifyPayment(user.id, dto);
  }
}
