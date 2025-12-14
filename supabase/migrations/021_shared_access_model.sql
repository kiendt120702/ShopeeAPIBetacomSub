-- Migration: Shared Access Model
-- Implement simple Admin/Member role system for shop sharing
-- 1 Shop có 1 Admin (owner) và nhiều Member (shared access)

-- Step 1: Drop existing user_shops table and recreate as shop_members
DROP TABLE IF EXISTS public.user_shops CASCADE;

-- Step 2: Create new shop_members table with role-based access
CREATE TABLE public.shop_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id bigint NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Simple role system: admin (owner) or member (shared access)
  role text NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Ensure one user cannot be added twice to same shop
  UNIQUE(shop_id, user_id)
);

-- Step 3: Add indexes for performance
CREATE INDEX idx_shop_members_user_id ON public.shop_members(user_id);
CREATE INDEX idx_shop_members_shop_id ON public.shop_members(shop_id);
CREATE INDEX idx_shop_members_role ON public.shop_members(role);

-- Step 4: Enable RLS on shop_members
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for shop_members table

-- Policy 1: Users can view shop members if they are members themselves
CREATE POLICY "Users can view shop members if they are members"
  ON public.shop_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shop_members.shop_id 
      AND sm.user_id = auth.uid()
    )
  );

-- Policy 2: Only admins can add new members
CREATE POLICY "Only admins can add members"
  ON public.shop_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shop_members.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Policy 3: Only admins can remove members (except themselves)
CREATE POLICY "Only admins can remove members"
  ON public.shop_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shop_members.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Policy 4: Only admins can update member roles
CREATE POLICY "Only admins can update member roles"
  ON public.shop_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shop_members.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Step 6: Update shops table RLS policies

-- Policy 1: Users can view shops if they are members
DROP POLICY IF EXISTS "Users can view shop data if they are members" ON public.shops;
CREATE POLICY "Users can view shop data if they are members"
  ON public.shops FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shops.shop_id 
      AND sm.user_id = auth.uid()
    )
  );

-- Policy 2: Only admins can delete shops
DROP POLICY IF EXISTS "Only Admin can delete shop" ON public.shops;
CREATE POLICY "Only admins can delete shops"
  ON public.shops FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shops.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Policy 3: Only admins can update shop tokens and sensitive data
DROP POLICY IF EXISTS "Users can update shop tokens" ON public.shops;
CREATE POLICY "Only admins can update shop data"
  ON public.shops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shops.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Policy 4: Allow shop creation (will be handled by application logic)
DROP POLICY IF EXISTS "Users can insert shops" ON public.shops;
CREATE POLICY "Authenticated users can create shops"
  ON public.shops FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Step 7: Create helper functions

-- Function to get user's role in a shop
CREATE OR REPLACE FUNCTION get_user_shop_role(p_shop_id bigint, p_user_id uuid DEFAULT auth.uid())
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.shop_members 
    WHERE shop_id = p_shop_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin of a shop
CREATE OR REPLACE FUNCTION is_shop_admin(p_shop_id bigint, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.shop_members 
    WHERE shop_id = p_shop_id 
    AND user_id = p_user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible shops
CREATE OR REPLACE FUNCTION get_user_shops(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  shop_id bigint,
  shop_name text,
  region text,
  role text,
  is_admin boolean,
  member_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.shop_id,
    s.shop_name,
    s.region,
    sm.role,
    (sm.role = 'admin') as is_admin,
    (SELECT COUNT(*) FROM shop_members sm2 WHERE sm2.shop_id = s.shop_id) as member_count
  FROM public.shops s
  INNER JOIN public.shop_members sm ON s.shop_id = sm.shop_id
  WHERE sm.user_id = p_user_id
  ORDER BY sm.role DESC, s.shop_name; -- Admins first, then alphabetical
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shop_members_updated_at
  BEFORE UPDATE ON public.shop_members
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_members_updated_at();

-- Step 9: Create view for easy shop member management
CREATE OR REPLACE VIEW shop_member_details AS
SELECT 
  sm.id,
  sm.shop_id,
  sm.user_id,
  sm.role,
  sm.created_at,
  sm.updated_at,
  s.shop_name,
  s.region,
  p.email,
  p.full_name,
  p.avatar_url
FROM public.shop_members sm
INNER JOIN public.shops s ON sm.shop_id = s.shop_id
LEFT JOIN public.profiles p ON sm.user_id = p.id;

-- Step 10: Add comments for documentation
COMMENT ON TABLE public.shop_members IS 'Role-based access control for shops - Admin (owner) and Member (shared access)';
COMMENT ON COLUMN public.shop_members.role IS 'User role: admin (full access) or member (read access)';
COMMENT ON FUNCTION get_user_shop_role IS 'Get user role in specific shop';
COMMENT ON FUNCTION is_shop_admin IS 'Check if user is admin of specific shop';
COMMENT ON FUNCTION get_user_shops IS 'Get all shops accessible to user with role information';
COMMENT ON VIEW shop_member_details IS 'Detailed view of shop members with user profile information';

-- Step 11: Grant necessary permissions
GRANT SELECT ON public.shop_members TO authenticated;
GRANT INSERT ON public.shop_members TO authenticated;
GRANT UPDATE ON public.shop_members TO authenticated;
GRANT DELETE ON public.shop_members TO authenticated;

GRANT SELECT ON shop_member_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_shop_role TO authenticated;
GRANT EXECUTE ON FUNCTION is_shop_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_shops TO authenticated;

COMMENT ON MIGRATION IS 'Implement Shared Access Model: Simple Admin/Member role system for shop sharing';