/*
  # Repair broken order FERE_1774262263405_0t8xi

  This order was cancelled by the client after the driver arrived, but due to a
  constraint error (canceller_role = 'membre' instead of 'client'), the cancellation
  record was never created. The order/delivery statuses were updated to 'cancelled'
  but the following were missing:

  1. Cancellation record in `cancellations` table
  2. Return delivery request for the driver to return the package to vendor
  3. Pending payout for the driver (400 FCFA driver_earnings)

  ## Data
  - Order ID: 99321b51-7e7d-4575-bcac-a3862183cafc
  - Original Delivery ID: fbb1cd6d-68a0-4d96-b353-2fc0ac42daa0
  - Driver ID: 34e67cb4-6e61-4f6c-8295-5e650f451de9
  - Client ID: 46df046d-113b-4678-987b-d467075dc1f8
  - Driver earnings: 400 FCFA
*/

DO $$
DECLARE
  v_order_id UUID := '99321b51-7e7d-4575-bcac-a3862183cafc';
  v_delivery_id UUID := 'fbb1cd6d-68a0-4d96-b353-2fc0ac42daa0';
  v_driver_id UUID := '34e67cb4-6e61-4f6c-8295-5e650f451de9';
  v_client_id UUID := '46df046d-113b-4678-987b-d467075dc1f8';
  v_cancellation_exists BOOLEAN;
  v_return_delivery_exists BOOLEAN;
  v_payout_exists BOOLEAN;
  v_pickup_point JSONB;
  v_delivery_point JSONB;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cancellations WHERE order_id = v_order_id
  ) INTO v_cancellation_exists;

  IF NOT v_cancellation_exists THEN
    INSERT INTO cancellations (
      order_id, cancelled_by, canceller_role, status_at_cancellation,
      refund_amount, delivery_fee_kept, requires_return
    ) VALUES (
      v_order_id, v_client_id, 'client', 'confirmed',
      0, true, true
    );
  END IF;

  SELECT pickup_point, delivery_point
  INTO v_pickup_point, v_delivery_point
  FROM delivery_requests
  WHERE id = v_delivery_id;

  SELECT EXISTS(
    SELECT 1 FROM delivery_requests WHERE order_id = v_order_id AND is_return = true
  ) INTO v_return_delivery_exists;

  IF NOT v_return_delivery_exists THEN
    INSERT INTO delivery_requests (
      order_id, driver_id, status, is_return, return_status,
      original_delivery_id, pickup_point, pickup_points,
      delivery_point, total_distance_meters,
      delivery_fee, driver_earnings, assigned_at
    ) VALUES (
      v_order_id, v_driver_id, 'assigned', true, 'en_route_vendor',
      v_delivery_id, v_delivery_point, CASE WHEN v_delivery_point IS NOT NULL THEN jsonb_build_array(v_delivery_point) ELSE '[]'::jsonb END,
      v_pickup_point, 0,
      0, 0, now()
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM pending_payouts WHERE delivery_request_id = v_delivery_id AND recipient_type = 'driver'
  ) INTO v_payout_exists;

  IF NOT v_payout_exists THEN
    INSERT INTO pending_payouts (
      recipient_id, recipient_type, amount, order_id,
      delivery_request_id, status, eligible_at
    ) VALUES (
      v_driver_id, 'driver', 400, v_order_id,
      v_delivery_id, 'pending', now()
    );
  END IF;
END $$;
