import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type AppPrismaClient } from "@jewellery/database";

import { PRISMA } from "../../prisma/prisma.module";

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Prisma.InputJsonValue;
}

/**
 * Writes append-only audit rows. Call it with the transaction client so the audit row
 * commits or rolls back together with the change it describes.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes ?? Prisma.JsonNull,
      },
    });
  }
}
