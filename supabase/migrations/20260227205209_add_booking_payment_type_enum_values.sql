/*
  # Add booking advance/balance payment type enum values

  1. Changes
    - Add `service_booking_advance` to `payment_type` enum
    - Add `service_booking_balance` to `payment_type` enum

  2. Reason
    - The booking payment flow uses these values when recording travel fee
      advance payments and service balance payments in `payment_transactions`
    - Without these values, the INSERT fails and the booking is never marked as paid

  3. Important Notes
    - No data is modified; only the enum type is extended
    - Existing rows using `service_booking` are unaffected
*/

ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'service_booking_advance';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'service_booking_balance';
