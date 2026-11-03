-- Full-text search for the catalogue.
-- PostgreSQL keeps "searchVector" in sync on every insert and update, so the application never writes it.
-- The English configuration gives stemming, so "rings" matches "ring". Weights favour the product name.

ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("sku", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("material", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;

CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
