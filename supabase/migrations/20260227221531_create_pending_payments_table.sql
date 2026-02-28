/*
  # Create pending_payments table

  Stores temporary payment session data before redirecting to Paystack.
  When the user returns from Paystack, we use the reference to recover
  all the context needed to complete the transaction.

  1. New Tables
    - `pending_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `reference` (text, unique) - Paystack payment reference
      - `payment_mode` (text) - e.g. checkout, balance, service_booking_advance, service_booking_balance
      - `amount` (numeric)
      - `booking_id` (uuid, nullable)
      - `order_id` (uuid, nullable)
      - `completion_type` (text, nullable) - for booking balance: full or partial
      - `checkout_data` (jsonb, nullable) - full checkout snapshot for order creation
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz) - auto-expire after 1 hour

  2. Security
    - Enable RLS on `pending_payments` table
    - Users can insert their own pending payments
    - Users can read their own pending payments
    - Users can delete their own pending payments
*/

CREATE TABLE IF NOT EXISTS pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  reference text UNIQUE NOT NULL,
  payment_mode text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  booking_id uuid,
  order_id uuid,
  completion_type text,
  checkout_data jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own pending payments"
  ON pending_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own pending payments"
  ON pending_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending payments"
  ON pending_payments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pending_payments_reference ON pending_payments(reference);
CREATE INDEX IF NOT EXISTS idx_pending_payments_user_id ON pending_payments(user_id);
