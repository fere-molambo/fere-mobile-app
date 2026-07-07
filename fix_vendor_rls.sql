-- fix_vendor_rls.sql — policies pour annulation vendeur
-- Appliquer via Supabase Dashboard SQL Editor (ou me demander de l'appliquer via MCP)

CREATE POLICY "Vendors can update orders for their shops" ON public.orders
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM shops
  WHERE shops.id = orders.shop_id
    AND (shops.owner_id = auth.uid() OR is_shop_team_member(auth.uid(), shops.id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM shops
  WHERE shops.id = orders.shop_id
    AND (shops.owner_id = auth.uid() OR is_shop_team_member(auth.uid(), shops.id))
));

CREATE POLICY "Vendors can update deliveries for their shop orders" ON public.delivery_requests
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM orders JOIN shops ON shops.id = orders.shop_id
  WHERE orders.id = delivery_requests.order_id
    AND (shops.owner_id = auth.uid() OR is_shop_team_member(auth.uid(), shops.id))
));

CREATE POLICY "Vendors can view deliveries for their shop orders" ON public.delivery_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM orders JOIN shops ON shops.id = orders.shop_id
  WHERE orders.id = delivery_requests.order_id
    AND (shops.owner_id = auth.uid() OR is_shop_team_member(auth.uid(), shops.id))
));

CREATE POLICY "Vendors can create refunds for their shop orders" ON public.refunds
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM orders JOIN shops ON shops.id = orders.shop_id
  WHERE orders.id = refunds.order_id
    AND (shops.owner_id = auth.uid() OR is_shop_team_member(auth.uid(), shops.id))
));
