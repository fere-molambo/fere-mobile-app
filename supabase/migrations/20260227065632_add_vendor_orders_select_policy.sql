/*
  # Add vendor SELECT policy on orders table

  1. Security Changes
    - Add SELECT policy on `orders` table for shop owners and team members
    - Vendors can view orders placed at their shops
    - Team members (equipe) can view orders for shops they are assigned to

  2. Important Notes
    - This fixes the bug where vendors could not see their orders
    - Uses the existing `is_shop_team_member()` function for team member checks
    - The `order_items` table already has the correct vendor SELECT policy
*/

CREATE POLICY "Vendors can view orders for their shops"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = orders.shop_id
      AND (shops.owner_id = auth.uid() OR is_shop_team_member(auth.uid(), shops.id))
    )
  );
