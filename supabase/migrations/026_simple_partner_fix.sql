-- Migration: Simple Partner Accounts Policy Fix
-- Fix RLS policies to allow admins to access partner accounts

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "partner_accounts_select_admin_new" ON partner_accounts;
DROP POLICY IF EXISTS "partner_accounts_select_temp" ON partner_accounts;

-- Create simple policy that works with both old and new role systems
CREATE POLICY "partner_accounts_admin_access" ON partner_accounts
  FOR ALL
  USING (
    -- Check if user is admin or super_admin using either system
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND (
        -- New role system
        (p.role_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM roles r 
          WHERE r.id = p.role_id 
          AND r.name IN ('admin', 'super_admin')
        ))
        OR
        -- Legacy role system fallback
        (p.role IN ('admin', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    -- Same check for inserts/updates
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND (
        -- New role system
        (p.role_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM roles r 
          WHERE r.id = p.role_id 
          AND r.name IN ('admin', 'super_admin')
        ))
        OR
        -- Legacy role system fallback
        (p.role IN ('admin', 'super_admin'))
      )
    )
  );

-- Test the policy
SELECT 'Testing partner accounts access after policy fix:' as info;

-- This should return partner accounts if user is admin
SELECT 
  id,
  partner_id,
  name,
  is_active
FROM partner_accounts
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 3;

COMMENT ON MIGRATION IS 'Simple fix for partner accounts RLS policies';