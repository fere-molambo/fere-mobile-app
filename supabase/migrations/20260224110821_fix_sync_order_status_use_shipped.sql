/*
  # Fix sync_order_status_from_delivery trigger to use 'shipped'

  1. Changes
    - Updated the `sync_order_status_from_delivery` function
    - Changed `v_new_status := 'in_transit'` to `v_new_status := 'shipped'`
    - The frontend expects 'shipped' status, not 'in_transit'
    - This aligns the DB trigger with the order status values used throughout the application

  2. Impact
    - Orders will now correctly transition to 'shipped' when delivery is in transit
    - The orders list will properly show these orders in the "En cours" tab
*/

CREATE OR REPLACE FUNCTION public.sync_order_status_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id uuid;
  v_total_requests int;
  v_delivered_count int;
  v_cancelled_count int;
  v_in_transit_count int;
  v_confirmed_count int;
  v_new_status text;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  
  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status IN ('picked_up', 'en_route_client', 'arrived')),
    COUNT(*) FILTER (WHERE status IN ('assigned', 'in_progress'))
  INTO v_total_requests, v_delivered_count, v_cancelled_count, v_in_transit_count, v_confirmed_count
  FROM public.delivery_requests
  WHERE order_id = v_order_id AND (is_return = false OR is_return IS NULL);
  
  IF v_total_requests = 0 THEN
    RETURN NEW;
  END IF;
  
  IF v_cancelled_count = v_total_requests THEN
    v_new_status := 'cancelled';
  ELSIF v_delivered_count = v_total_requests THEN
    v_new_status := 'delivered';
  ELSIF v_delivered_count + v_cancelled_count = v_total_requests AND v_delivered_count > 0 THEN
    v_new_status := 'delivered';
  ELSIF v_in_transit_count > 0 OR v_delivered_count > 0 THEN
    v_new_status := 'shipped';
  ELSIF v_confirmed_count > 0 THEN
    v_new_status := 'confirmed';
  ELSE
    v_new_status := 'pending';
  END IF;
  
  UPDATE public.orders
  SET status = v_new_status, updated_at = now()
  WHERE id = v_order_id AND status != v_new_status;
  
  RETURN NEW;
END;
$$;