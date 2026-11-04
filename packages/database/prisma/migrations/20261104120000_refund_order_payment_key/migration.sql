-- A refund must belong to the same order as the payment it refunds.
--
-- Payment(orderId, id) becomes a unique target, and Refund's payment reference becomes the
-- composite key (orderId, paymentId). A refund whose order and payment disagree is refused by
-- the database.
--
-- Rollback (only if no later migration depends on this one):
--   ALTER TABLE "Refund" DROP CONSTRAINT "Refund_orderId_paymentId_fkey";
--   ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey"
--     FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
--   DROP INDEX "Payment_orderId_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_id_key" ON "Payment"("orderId", "id");

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_paymentId_fkey";

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_paymentId_fkey" FOREIGN KEY ("orderId", "paymentId") REFERENCES "Payment"("orderId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;