-- Integrity rules that Prisma's schema language cannot express.
-- Money is never negative, quantities are positive, and totals add up.
-- These are a last line of defence. The API validates the same rules first.

-- Product prices
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_compare_at_price_valid"
  CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= "price");

-- Inventory: stock can never go negative, and reservations cannot exceed stock on hand
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_on_hand_non_negative" CHECK ("quantityOnHand" >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_reserved_non_negative" CHECK ("quantityReserved" >= 0);
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_reserved_within_on_hand"
  CHECK ("quantityReserved" <= "quantityOnHand");

-- Cart
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);

-- Coupons
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_discount_value_positive" CHECK ("discountValue" > 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_percentage_max_100"
  CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_used_count_non_negative" CHECK ("usedCount" >= 0);

-- Orders: the total must equal subtotal minus discount plus shipping and tax
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "discountAmount" >= 0 AND "shippingAmount" >= 0 AND "taxAmount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_consistent"
  CHECK ("totalAmount" = "subtotal" - "discountAmount" + "shippingAmount" + "taxAmount");

-- Order lines are immutable snapshots, so their arithmetic must hold
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_line_total_consistent"
  CHECK ("lineTotal" = "unitPrice" * "quantity");

-- Payments
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

-- Reviews
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- At most one default address per user
CREATE UNIQUE INDEX "Address_one_default_per_user" ON "Address"("userId") WHERE "isDefault" = true;
