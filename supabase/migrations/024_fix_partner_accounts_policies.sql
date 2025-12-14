-- Migration: Fix Partner Accounts RLS Policies
-- Update policies to work with new role system

-- Step 1: Drop old policies
DROP POLICY IF EXISTS "partner_accounts_select_admin" ON partner_accounts;
DROP POLICY IF EXISTS "partner_accounts_insert_admin" ON partner_accounts;
DROP POLICY IF EXISTS "partner_accounts_update_admin" ON partner_accounts;
DROP POLICY IF EXISTS "partner_accounts_delete_super_admin" ON partner_accounts;

-- Step 2: Create new policies using role system functions

-- SELECT: Admin and Super Admin can view
CREATE POLICY "partner_accounts_select_admin_new" ON partner_accounts
  FOR SELECT
  USING (
    is_admin_or_super(auth.uid())
  );

-- INSERT: Admin and Super Admin can create
CREATE POLICY "partner_accounts_insert_admin_new" ON partner_accounts
  FOR INSERT
  WITH CHECK (
    is_admin_or_super(auth.uid())
  );

-- UPDATE: Admin and Super Admin can update
CREATE POLICY "partner_accounts_update_admin_new" ON partner_accounts
  FOR UPDATE
  USING (
    is_admin_or_super(auth.uid())
  );

-- DELETE: Only Super Admin can delete
CREATE POLICY "partner_accounts_delete_super_admin_new" ON partner_accounts
  FOR DELETE
  USING (
    is_super_admin(auth.uid())
  );

-- Step 3: Grant permissions
GRANT SELECT, INSERT, UPDATE ON partner_accounts TO authenticated;
GRANT DELETE ON partner_accounts TO authenticated; -- RLS will control actual access

COMMENT ON MIGRATION IS 'Fix Partner Accounts RLS policies to work with new role system';