import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiExcludeController, ApiOperation } from "@nestjs/swagger";
import { Public } from "../../common/auth/auth.decorators";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";

import { PaymentsService } from "./payments.service";

/** Razorpay calls this endpoint. Authentication is the HMAC signature on the raw body, not a bearer token. */
@ApiExcludeController()
@SkipThrottle({ default: true })
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post("razorpay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Razorpay payment webhook" })
  async razorpay(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-razorpay-signature") signature: string | undefined,
    @Headers("x-razorpay-event-id") eventId: string | undefined,
  ): Promise<{ received: true; duplicate: boolean }> {
    if (!req.rawBody) {
      // Raw body capture is enabled in main.ts. Without it the signature cannot be checked.
      throw new Error("Raw request body is not available for signature verification");
    }
    const result = await this.payments.handleWebhook(req.rawBody, signature, eventId);
    return { received: true, duplicate: result === "duplicate" };
  }
}
