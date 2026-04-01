/*
  # Fix auto_create_refund_on_cancellation trigger

  1. Changes
    - Updated the trigger function to check `delivery_fee_kept` and `requires_return` columns
    - When both `delivery_fee_kept = true` AND `requires_return = true`, no refund is created
    - This handles the case where a client cancels after driver arrival:
      the advance is not refunded (it goes to the driver as payout)

  2. Important Notes
    - The existing logic for booking cancellations remains unchanged
    - Only the order cancellation path is affected
*/

CREATE OR REPLACE FUNCTION auto_create_refund_on_cancellation()
RETURNS trigger AS $$
DECLARE
  v_order RECORD;
  v_booking RECORD;
  v_refund_amount NUMERIC := 0;
  v_user_id UUID;
  v_payment_ref TEXT;
BEGIN
  -- CASE 1: Order cancellation
  IF NEW.order_id IS NOT NULL THEN
    IF NEW.delivery_fee_kept = true AND NEW.requires_return = true THEN
      RETURN NEW;
    END IF;

    SELECT id, user_id, payment_status, advance_paid, advance_amount, payment_reference
    INTO v_order
    FROM public.orders
    WHERE id = NEW.order_id;

    IF v_order IS NOT NULL AND v_order.payment_status IN ('paid', 'partial') THEN
      v_refund_amount := COALESCE(v_order.advance_paid, v_order.advance_amount, 0);
      v_user_id := v_order.user_id;
      v_payment_ref := v_order.payment_reference;

      IF v_refund_amount > 0 THEN
        INSERT INTO public.refunds (
          order_id, user_id, amount, net_refund,
          transaction_fee_deducted, original_payment_reference,
          status, refund_status, cancellation_id
        ) VALUES (
          NEW.order_id, v_user_id, v_refund_amount, v_refund_amount,
          0, v_payment_ref,
          'pending', 'pending', NEW.id
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

  -- CASE 2: Booking cancellation
  ELSIF NEW.booking_id IS NOT NULL THEN
    SELECT id, customer_id, travel_fee, travel_fee_paid, status
    INTO v_booking
    FROM public.service_bookings
    WHERE id = NEW.booking_id;

    IF v_booking IS NOT NULL AND v_booking.travel_fee_paid = true AND COALESCE(v_booking.travel_fee, 0) > 0 THEN
      v_refund_amount := v_booking.travel_fee;
      v_user_id := v_booking.customer_id;

      INSERT INTO public.refunds (
        booking_id, user_id, amount, net_refund,
        transaction_fee_deducted,
        status, refund_status, cancellation_id
      ) VALUES (
        NEW.booking_id, v_user_id, v_refund_amount, v_refund_amount,
        0,
        'pending', 'pending_manual', NEW.id
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
