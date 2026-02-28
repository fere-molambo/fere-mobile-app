/*
  # Add is_active column to shop_team_members

  1. Modified Tables
    - `shop_team_members`
      - Added `is_active` (boolean, default true) to filter active team members

  2. Important Notes
    - Existing rows will default to true (active)
    - This allows soft-deactivation of team members without deleting the record
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shop_team_members' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE shop_team_members ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;
