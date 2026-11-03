-- Product video (Cloudinary), reservation expiry on orders, and courier booking retry state.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "videoPublicId" VARCHAR(255),
ADD COLUMN     "videoUrl" VARCHAR(500);

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "bookingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" VARCHAR(500);

-- CreateIndex
CREATE INDEX "Order_status_reservationExpiresAt_idx" ON "Order"("status", "reservationExpiresAt");