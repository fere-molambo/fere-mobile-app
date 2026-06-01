/*
  # Create account deletion requests table

  1. New Tables
    - `account_deletion_requests`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, references auth.users)
      - `contact_info` (text, nullable - used on web form without login)
      - `reason` (text, nullable - optional reason from user)
      - `status` (text: pending, approved, rejected, completed - default: pending)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `account_deletion_requests` table
    - Authenticated users can insert their own deletion requests
    - Authenticated users can read their own deletion requests
*/

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  contact_info text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own deletion request"
  ON account_deletion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own deletion requests"
  ON account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
