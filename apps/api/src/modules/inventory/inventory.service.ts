import { Inject, Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import type { AppPrismaClient, Prisma } from "@jewellery/database";

import { AuditService } from "../audit/audit.service";
import { PRISMA } from "../../prisma/prisma.module";
import type { AdjustInventoryDto } from "./dto/inventory.dto";

export interface InventoryView {
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
  updatedAt: Date;
}

@Injectable()
export class InventoryService {
  constructor(
    @Inject(PRISMA) private readonly prisma: AppPrismaClient,
    private readonly audit: AuditService,
  ) {}

  async getForProduct(productId: string): Promise<InventoryView> {
    const row = await this.prisma.inventory.findUnique({ where: { productId } });
    if (!row) {
      throw new NotFoundException("Inventory record not found");
    }
    return toView(row);
  }

  /**
   * Sets or adjusts stock inside a transaction, with the change written to the audit log.
   * Stock can never go negative, and it can never drop below the units held by pending orders.
   */
  async adjust(
    productId: string,
    input: AdjustInventoryDto,
    actorId: string,
  ): Promise<InventoryView> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inventory.findUnique({ where: { productId } });
      if (!current) {
        throw new NotFoundException("Inventory record not found");
      }

      const nextOnHand =
        input.mode === "SET" ? input.quantity : current.quantityOnHand + input.quantity;

      if (nextOnHand < 0) {
        throw new BadRequestException("Stock cannot be negative");
      }
      if (nextOnHand < current.quantityReserved) {
        throw new BadRequestException(
          `Stock cannot be lower than the ${current.quantityReserved} unit(s) reserved by pending orders`,
        );
      }

      const updated = await tx.inventory.update({
        where: { productId },
        data: { quantityOnHand: nextOnHand },
      });

      await this.audit.record(
        {
          actorId,
          action: "inventory.adjusted",
          entityType: "Inventory",
          entityId: productId,
          changes: {
            mode: input.mode,
            requested: input.quantity,
            before: current.quantityOnHand,
            after: nextOnHand,
            reason: input.reason,
          } satisfies Prisma.InputJsonObject,
        },
        tx,
      );

      return toView(updated);
    });
  }
}

function toView(row: {
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
  updatedAt: Date;
}): InventoryView {
  return {
    productId: row.productId,
    quantityOnHand: row.quantityOnHand,
    quantityReserved: row.quantityReserved,
    lowStockThreshold: row.lowStockThreshold,
    updatedAt: row.updatedAt,
  };
}
