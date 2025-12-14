-- Migration: Debug Partner Accounts Policies
-- Ensure policies work correctly for shop connection

-- Step 1: Check current policies
SELECT 'Current Partner Accounts Policies:' as info;
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'partner_accounts'
ORDER BY policyname;

-- Step 2: Test role functions
SELECT 'Testing Role Functions:' as info;

-- This should work for any authenticated user
SELECT 
  'get_user_system_role' as function_name,
  get_user_system_role() as result;

SELECT 
  'is_admin_or_super' as function_name,
  is_admin_or_super() as result;

-- Step 3: Check if policies are too restrictive
-- Temporarily create a more permissive policy for testing

-- Drop existing policies
DROP POLICY IF EXISTS "partner_accounts_select_admin_new" ON partner_accounts;

-- Create a temporary more permissive policy
CREATE POLICY "partner_accounts_select_temp" ON partner_accounts
  FOR SELECT
  USING (
    -- Allow admins and super admins to read
    EXISTS (
      SELECT 1 FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() 
      AND r.name IN ('admin', 'super_admin')
    )
    OR
    -- Fallback: check legacy role column
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Step 4: Test partner accounts access
SELECT 'Testing Partner Accounts Access:' as info;
SELECT 
  id,
  partner_id,
  name,
  is_active
FROM partner_accounts
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 3;

COMMENT ON MIGRATION IS 'Debug Partner Accounts policies for shop connection dialog';