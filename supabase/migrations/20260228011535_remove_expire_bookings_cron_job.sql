/*
  # Remove expire-bookings cron job

  1. Changes
    - Removes the `expire-pending-bookings` cron job that was auto-cancelling bookings after 24 hours
    - This is no longer needed because bookings are now cancelled immediately (rollback) if payment initialization fails
    - If a booking exists in "pending" status, it means the user is in the middle of a payment flow

  2. Important Notes
    - The expire-bookings Edge Function is left deployed as a safety net but will no longer be triggered by cron
    - The `auto_cancel_at` column is left in the table (nullable) to avoid destructive changes
*/

SELECT cron.unschedule('expire-pending-bookings');
