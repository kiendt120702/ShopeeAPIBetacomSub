-- Migration: Fix shops RLS policies
-- Date: 2024-12-14
-- Description: Allow authenticated users to insert/update shops

-- Drop ALL existing policies on shops
DROP POLICY IF EXISTS "Users can view shops" ON shops;
DROP POLICY IF EXISTS "Users can insert shops" ON shops;
DROP POLICY IF EXISTS "Users can update shops" ON shops;
DROP POLICY IF EXISTS "Authenticated users can view shops" ON shops;
DROP POLICY IF EXISTS "Authenticated users can insert shops" ON shops;
DROP POLICY IF EXISTS "Authenticated users can update shops" ON shops;
DROP POLICY IF EXISTS "Authenticated users can update their shops" ON shops;

-- Enable RLS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can view all shops
CREATE POLICY "Authenticated users can view shops"
  ON shops FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Anyone authenticated can insert shops
CREATE POLICY "Authenticated users can insert shops"
  ON shops FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Anyone authenticated can update shops
CREATE POLICY "Authenticated users can update shops"
  ON shops FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Fix shop_members RLS as well
DROP POLICY IF EXISTS "Users can view shop members" ON shop_members;
DROP POLICY IF EXISTS "Users can insert shop members" ON shop_members;
DROP POLICY IF EXISTS "Users can update shop members" ON shop_members;
DROP POLICY IF EXISTS "Users can delete shop members" ON shop_members;

ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own memberships
CREATE POLICY "Users can view shop members"
  ON shop_members FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can insert their own memberships
CREATE POLICY "Users can insert shop members"
  ON shop_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own memberships
CREATE POLICY "Users can update shop members"
  ON shop_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can delete their own memberships
CREATE POLICY "Users can delete shop members"
  ON shop_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shop_members_user_shop_unique'
  ) THEN
    ALTER TABLE shop_members ADD CONSTRAINT shop_members_user_shop_unique UNIQUE (user_id, shop_id);
  END IF;
END $$;
