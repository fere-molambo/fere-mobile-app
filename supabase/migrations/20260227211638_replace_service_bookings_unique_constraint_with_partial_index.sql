/*
  # Replace unique constraint with partial index

  1. Changes
    - Drop the existing unique constraint on (service_id, booking_date, booking_time)
    - Create a partial unique index that only applies to active bookings
    - This allows re-booking a slot if the previous booking was cancelled or expired

  2. Security
    - No security changes

  3. Notes
    - Cancelled and expired bookings will no longer block new bookings for the same slot
    - Only pending, confirmed, partial, in_progress, and completed bookings block the slot
*/

ALTER TABLE service_bookings 
DROP CONSTRAINT IF EXISTS service_bookings_service_id_booking_date_booking_time_key;

CREATE UNIQUE INDEX IF NOT EXISTS service_bookings_active_slot_unique 
ON service_bookings (service_id, booking_date, booking_time) 
WHERE status NOT IN ('cancelled', 'expired');
