import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Address, AppPrismaClient } from "@jewellery/database";

import { PRISMA } from "../../prisma/prisma.module";
import { withoutUndefined } from "../../common/utils/defined";
import type { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";

export const MAX_ADDRESSES_PER_USER = 10;

@Injectable()
export class AddressesService {
  constructor(@Inject(PRISMA) private readonly prisma: AppPrismaClient) {}

  list(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async get(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException("Address not found");
    return address;
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new BadRequestException(`You can save up to ${MAX_ADDRESSES_PER_USER} addresses`);
    }

    return this.prisma.$transaction(async (tx) => {
      // The first address becomes the default automatically.
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          label: dto.label ?? null,
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: "IN",
          isDefault: makeDefault,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<Address> {
    await this.get(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id },
        data: withoutUndefined({
          label: dto.label,
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          isDefault: dto.isDefault,
        }),
      });
    });
  }

  /** Deleting the default promotes the most recent remaining address, so checkout always has a default. */
  async remove(userId: string, id: string): Promise<void> {
    const address = await this.get(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }
}
