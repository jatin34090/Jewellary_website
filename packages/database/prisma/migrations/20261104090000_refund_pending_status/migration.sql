-- A refund is recorded as PENDING before the provider is called, so an unknown outcome is never lost.
ALTER TYPE "RefundStatus" ADD VALUE 'PENDING' BEFORE 'PROCESSED';
