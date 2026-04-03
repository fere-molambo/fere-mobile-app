/*
  # Auto-create driver payout on cancellation-at-arrival

  1. New Function
    - `auto_create_driver_payout_on_cancellation` (SECURITY DEFINER)
      - Fires AFTER INSERT on `cancellations`
      - Only acts when `delivery_fee_kept = true` AND `requires_return = true` (cancelled at arrival)
      - Looks up the original (non-return) delivery request for the order
      - Creates a `pending_payouts` row for the driver with the original `driver_earnings`
      - Uses ON CONFLICT DO NOTHING to prevent duplicates

  2. New Trigger
    - `trg_auto_create_driver_payout_on_cancellation` on `cancellations` table

  3. Data Repair
    - Inserts missing payout for order `720af199-68ce-443c-8478-c1336dcd0864`
      (driver `34e67cb4`, delivery `39fc883c`, 400 XOF)

  4. Stale Data Cleanup
    - Removes expired/orphaned `pending_payments` rows for cancelled orders
      and orphaned checkout rows with no order

  5. Security
    - Drops the old client INSERT policy on `pending_payouts` (no longer needed
      since the trigger runs with SECURITY DEFINER)

  6. Important Notes
    - The trigger bypasses RLS, solving the race condition where the client
      tried to insert the payout before the order was marked as cancelled
    - Client code should be updated to remove the manual payout insert
*/

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.auto_create_driver_payout_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_fee_kept IS NOT TRUE OR NEW.requires_return IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT id, driver_id, driver_earnings
  INTO v_delivery
  FROM public.delivery_requests
  WHERE order_id = NEW.order_id
    AND is_return = false
  LIMIT 1;

  IF v_delivery IS NULL OR v_delivery.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pending_payouts (
    recipient_id,
    recipient_type,
    amount,
    order_id,
    delivery_request_id,
    status,
    eligible_at
  ) VALUES (
    v_delivery.driver_id,
    'driver',
    COALESCE(v_delivery.driver_earnings, 0),
    NEW.order_id,
    v_delivery.id,
    'pending',
    now()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_auto_create_driver_payout_on_cancellation'
      AND tgrelid = 'public.cancellations'::regclass
  ) THEN
    CREATE TRIGGER trg_auto_create_driver_payout_on_cancellation
      AFTER INSERT ON public.cancellations
      FOR EACH ROW
      EXECUTE FUNCTION public.auto_create_driver_payout_on_cancellation();
  END IF;
END $$;

-- 3. Repair missing payout for order FERE_1775186079997_sg72a
INSERT INTO public.pending_payouts (
  recipient_id,
  recipient_type,
  amount,
  order_id,
  delivery_request_id,
  status,
  eligible_at
) SELECT
  '34e67cb4-6e61-4f6c-8295-5e650f451de9',
  'driver',
  400,
  '720af199-68ce-443c-8478-c1336dcd0864',
  '39fc883c-89f1-47bb-83fc-afbb9572f5bf',
  'pending',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.pending_payouts
  WHERE order_id = '720af199-68ce-443c-8478-c1336dcd0864'
    AND recipient_id = '34e67cb4-6e61-4f6c-8295-5e650f451de9'
);

-- 4. Clean up stale pending_payments for cancelled orders and orphaned checkouts
DELETE FROM public.pending_payments
WHERE (order_id IN (
  SELECT id FROM public.orders WHERE status = 'cancelled'
))
OR (order_id IS NULL AND expires_at < now());

-- 5. Drop the old client INSERT policy (trigger handles this now)
DROP POLICY IF EXISTS "Clients can create payouts for cancelled orders" ON public.pending_payouts;
