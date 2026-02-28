/*
  # Add product_reviews and service_reviews tables

  ## Summary
  Creates two new review tables for products and services, mirroring the existing
  shop_reviews structure. Also updates review_replies to support all three review types.

  ## New Tables

  ### product_reviews
  - `id` (uuid, PK) - unique identifier
  - `product_id` (uuid, FK products) - the reviewed product
  - `user_id` (uuid, FK profiles) - the reviewer
  - `rating` (integer, 1-5) - star rating
  - `comment` (text, nullable) - optional comment
  - `created_at` (timestamptz) - creation timestamp
  - `updated_at` (timestamptz) - last update timestamp
  - UNIQUE constraint on (product_id, user_id) — one review per member per product

  ### service_reviews
  - `id` (uuid, PK) - unique identifier
  - `service_id` (uuid, FK services) - the reviewed service
  - `user_id` (uuid, FK profiles) - the reviewer
  - `rating` (integer, 1-5) - star rating
  - `comment` (text, nullable) - optional comment
  - `created_at` (timestamptz) - creation timestamp
  - `updated_at` (timestamptz) - last update timestamp
  - UNIQUE constraint on (service_id, user_id) — one review per member per service

  ## Modified Tables

  ### review_replies
  - Added `product_review_id` (uuid, nullable FK product_reviews) - link to a product review reply
  - Added `service_review_id` (uuid, nullable FK service_reviews) - link to a service review reply
  - Added `updated_at` (timestamptz) - last update timestamp
  - Made `review_id` nullable so it is optional when replying to product/service reviews
  - Added CHECK constraint ensuring exactly one of (review_id, product_review_id, service_review_id) is set

  ## Security
  - RLS enabled on both new tables
  - Public SELECT, authenticated INSERT/UPDATE/DELETE with ownership checks
  - review_replies INSERT policy updated to also allow replies on product/service reviews
*/

-- ============================================================
-- 1. Create product_reviews table
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT product_reviews_product_id_user_id_key UNIQUE (product_id, user_id)
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product reviews"
  ON product_reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create their own product reviews"
  ON product_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product reviews"
  ON product_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product reviews"
  ON product_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. Create service_reviews table
-- ============================================================
CREATE TABLE IF NOT EXISTS service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT service_reviews_service_id_user_id_key UNIQUE (service_id, user_id)
);

ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view service reviews"
  ON service_reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create their own service reviews"
  ON service_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own service reviews"
  ON service_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own service reviews"
  ON service_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Update review_replies to support product/service reviews
-- ============================================================

-- Add updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_replies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE review_replies ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Make review_id nullable (was NOT NULL, but now one of 3 can be set)
ALTER TABLE review_replies ALTER COLUMN review_id DROP NOT NULL;

-- Add product_review_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_replies' AND column_name = 'product_review_id'
  ) THEN
    ALTER TABLE review_replies ADD COLUMN product_review_id uuid REFERENCES product_reviews(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add service_review_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_replies' AND column_name = 'service_review_id'
  ) THEN
    ALTER TABLE review_replies ADD COLUMN service_review_id uuid REFERENCES service_reviews(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add CHECK constraint: exactly one of the three FK columns must be set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'review_replies' AND constraint_name = 'review_replies_single_target_check'
  ) THEN
    ALTER TABLE review_replies ADD CONSTRAINT review_replies_single_target_check
      CHECK (
        (
          (review_id IS NOT NULL)::int +
          (product_review_id IS NOT NULL)::int +
          (service_review_id IS NOT NULL)::int
        ) = 1
      );
  END IF;
END $$;

-- ============================================================
-- 4. Update review_replies RLS policies to include new types
-- ============================================================

-- Drop and recreate the INSERT policy to allow replies on product/service reviews
DROP POLICY IF EXISTS "Shop managers can create replies" ON review_replies;

CREATE POLICY "Authenticated users can create replies"
  ON review_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (review_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM shop_reviews r WHERE r.id = review_replies.review_id
      ))
      OR
      (product_review_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM product_reviews r WHERE r.id = review_replies.product_review_id
      ))
      OR
      (service_review_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM service_reviews r WHERE r.id = review_replies.service_review_id
      ))
    )
  );

-- Update DELETE policy to also handle product/service review replies
DROP POLICY IF EXISTS "Users or shop managers can delete replies" ON review_replies;

CREATE POLICY "Users or managers can delete replies"
  ON review_replies FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      review_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM shop_reviews r
        WHERE r.id = review_replies.review_id
          AND can_manage_shop_reviews(r.shop_id, auth.uid())
      )
    )
  );
