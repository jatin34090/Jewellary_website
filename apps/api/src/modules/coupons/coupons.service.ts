import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, type AppPrismaClient, type Coupon } from "@jewellery/database";

import { money, ZERO } from "../../common/money";
import { PRISMA } from "../../prisma/prisma.module";
import { AuditService } from "../audit/audit.service";
import { withoutUndefined } from "../../common/utils/defined";
import type { CreateCouponDto, UpdateCouponDto } from "./dto/coupon.dto";

export interface CouponCheck {
  coupon: Coupon | null;
  /** Customer-facing reason when the coupon cannot be used. Null when it is valid. */
  error: string | null;
}

@Injectable()
export class CouponsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly audit: AuditService,
  ) {}

  /** Checks a coupon against the current subtotal, without changing anything. */
  async check(code: string, subtotal: Prisma.Decimal, now = new Date()): Promise<CouponCheck> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!coupon || !coupon.isActive)
      return { coupon: null, error: "This coupon code is not valid" };
    if (coupon.startsAt > now) return { coupon: null, error: "This coupon is not active yet" };
    if (coupon.expiresAt && coupon.expiresAt <= now)
      return { coupon: null, error: "This coupon has expired" };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { coupon: null, error: "This coupon has been fully used" };
    }
    if (subtotal.lt(coupon.minOrderAmount)) {
      return {
        coupon: null,
        error: `This coupon needs a minimum order of ₹${money(coupon.minOrderAmount).toFixed(2)}`,
      };
    }
    return { coupon, error: null };
  }

  /** The discount a valid coupon gives on a subtotal. Never more than the subtotal itself. */
  static discountFor(coupon: Coupon, subtotal: Prisma.Decimal): Prisma.Decimal {
    let discount =
      coupon.discountType === "PERCENTAGE"
        ? subtotal.mul(coupon.discountValue).div(100)
        : new Prisma.Decimal(coupon.discountValue);

    if (coupon.discountType === "PERCENTAGE" && coupon.maxDiscountAmount !== null) {
      discount = Prisma.Decimal.min(discount, coupon.maxDiscountAmount);
    }
    discount = Prisma.Decimal.min(discount, subtotal);
    return money(discount.gt(ZERO) ? discount : ZERO);
  }

  list(): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  }

  async create(dto: CreateCouponDto, actorId: string): Promise<Coupon> {
    this.assertValues(dto.discountType, dto.discountValue);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const coupon = await tx.coupon.create({
          data: {
            code: dto.code.toUpperCase(),
            description: dto.description ?? null,
            discountType: dto.discountType,
            discountValue: dto.discountValue,
            maxDiscountAmount: dto.maxDiscountAmount ?? null,
            minOrderAmount: dto.minOrderAmount ?? 0,
            usageLimit: dto.usageLimit ?? null,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            isActive: dto.isActive ?? true,
          },
        });
        await this.audit.record(
          { actorId, action: "coupon.created", entityType: "Coupon", entityId: coupon.id },
          tx,
        );
        return coupon;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A coupon with this code already exists");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCouponDto, actorId: string): Promise<Coupon> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Coupon not found");
    this.assertValues(
      dto.discountType ?? existing.discountType,
      dto.discountValue ?? existing.discountValue.toNumber(),
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.coupon.update({
        where: { id },
        data: withoutUndefined({
          description: dto.description,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          maxDiscountAmount: dto.maxDiscountAmount,
          minOrderAmount: dto.minOrderAmount,
          usageLimit: dto.usageLimit,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          isActive: dto.isActive,
        }),
      });
      await this.audit.record(
        {
          actorId,
          action: "coupon.updated",
          entityType: "Coupon",
          entityId: id,
          changes: { fields: Object.keys(dto) } satisfies Prisma.InputJsonObject,
        },
        tx,
      );
      return updated;
    });
  }

  private assertValues(type: string, value: string | number | Prisma.Decimal): void {
    const numeric = Number(value);
    if (numeric <= 0) throw new BadRequestException("Discount value must be greater than zero");
    if (type === "PERCENTAGE" && numeric > 100) {
      throw new BadRequestException("A percentage discount cannot exceed 100");
    }
  }
}
