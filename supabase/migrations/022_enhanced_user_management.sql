-- Migration: Enhanced User Management System (Fixed)
-- Implement hierarchical role system: Super Admin > Admin > Member
-- Super Admin: Full system access
-- Admin: Can manage users, shops, and assign shop access to members
-- Member: Can only view assigned shops, no management rights

-- Step 1: Create roles table for system-wide roles
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('super_admin', 'admin', 'member')),
  display_name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default roles
INSERT INTO public.roles (name, display_name, description, permissions) VALUES
('super_admin', 'Super Admin', 'Full system access and user management', 
 '["manage_users", "manage_shops", "manage_roles", "view_all_data", "system_settings"]'::jsonb),
('admin', 'Admin', 'Can manage users and shops, assign shop access to members', 
 '["manage_users", "manage_shops", "assign_shop_access", "view_assigned_data"]'::jsonb),
('member', 'Member', 'Can only view assigned shops, no management rights', 
 '["view_assigned_shops"]'::jsonb);

-- Step 2: Update profiles table to use the new role system
-- First, backup existing role data
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS old_role text;
UPDATE public.profiles SET old_role = role WHERE old_role IS NULL;

-- Add new role_id column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id);

-- Set default role_id based on existing role
UPDATE public.profiles SET role_id = (
  SELECT id FROM public.roles WHERE name = 
  CASE 
    WHEN profiles.role = 'super_admin' THEN 'super_admin'
    WHEN profiles.role = 'admin' THEN 'admin'
    ELSE 'member'
  END
) WHERE role_id IS NULL;

-- Step 3: Create function to get default member role and set up trigger
CREATE OR REPLACE FUNCTION get_default_member_role_id()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT id FROM public.roles WHERE name = 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to set default role for new profiles
CREATE OR REPLACE FUNCTION set_default_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    NEW.role_id = get_default_member_role_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set default role
DROP TRIGGER IF EXISTS trigger_set_default_profile_role ON public.profiles;
CREATE TRIGGER trigger_set_default_profile_role
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_profile_role();

-- Make role_id NOT NULL after setting defaults
ALTER TABLE public.profiles ALTER COLUMN role_id SET NOT NULL;

-- Step 4: Create user management table for admin-member relationships
CREATE TABLE public.user_management (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  -- Ensure admin cannot manage themselves and no duplicate relationships
  CHECK (admin_id != member_id),
  UNIQUE(admin_id, member_id)
);

-- Step 5: Create shop access assignments table
CREATE TABLE public.shop_access_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id bigint NOT NULL REFERENCES public.shops(shop_id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  access_level text NOT NULL CHECK (access_level IN ('read_only', 'limited')) DEFAULT 'read_only',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Ensure no duplicate assignments
  UNIQUE(shop_id, member_id)
);

-- Step 6: Add indexes for performance
CREATE INDEX idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX idx_user_management_admin_id ON public.user_management(admin_id);
CREATE INDEX idx_user_management_member_id ON public.user_management(member_id);
CREATE INDEX idx_shop_access_assignments_shop_id ON public.shop_access_assignments(shop_id);
CREATE INDEX idx_shop_access_assignments_member_id ON public.shop_access_assignments(member_id);
CREATE INDEX idx_shop_access_assignments_assigned_by ON public.shop_access_assignments(assigned_by);

-- Step 7: Enable RLS on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_access_assignments ENABLE ROW LEVEL SECURITY;

-- Step 8: Create helper functions

-- Function to get user's system role
CREATE OR REPLACE FUNCTION get_user_system_role(p_user_id uuid DEFAULT auth.uid())
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT r.name 
    FROM public.profiles p
    INNER JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin or super admin
CREATE OR REPLACE FUNCTION is_admin_or_super(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT r.name IN ('admin', 'super_admin')
    FROM public.profiles p
    INNER JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT r.name = 'super_admin'
    FROM public.profiles p
    INNER JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users managed by admin
CREATE OR REPLACE FUNCTION get_managed_users(p_admin_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  role_name text,
  role_display_name text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    r.name,
    r.display_name,
    um.created_at
  FROM public.user_management um
  INNER JOIN public.profiles p ON um.member_id = p.id
  INNER JOIN public.roles r ON p.role_id = r.id
  WHERE um.admin_id = p_admin_id
  ORDER BY um.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get shops accessible to member (including assigned shops)
CREATE OR REPLACE FUNCTION get_member_accessible_shops(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  shop_id bigint,
  shop_name text,
  region text,
  access_type text,
  access_level text,
  assigned_by_name text
) AS $$
BEGIN
  RETURN QUERY
  -- Shops where user is admin/member in shop_members table
  SELECT 
    s.shop_id,
    s.shop_name,
    s.region,
    'direct'::text as access_type,
    sm.role::text as access_level,
    NULL::text as assigned_by_name
  FROM public.shops s
  INNER JOIN public.shop_members sm ON s.shop_id = sm.shop_id
  WHERE sm.user_id = p_user_id
  
  UNION ALL
  
  -- Shops assigned by admin through shop_access_assignments
  SELECT 
    s.shop_id,
    s.shop_name,
    s.region,
    'assigned'::text as access_type,
    saa.access_level,
    p_admin.full_name as assigned_by_name
  FROM public.shops s
  INNER JOIN public.shop_access_assignments saa ON s.shop_id = saa.shop_id
  LEFT JOIN public.profiles p_admin ON saa.assigned_by = p_admin.id
  WHERE saa.member_id = p_user_id
  
  ORDER BY access_type, shop_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create RLS policies

-- Roles table policies
CREATE POLICY "Everyone can view roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- User management policies
CREATE POLICY "Admins can view their managed users"
  ON public.user_management FOR SELECT
  USING (
    admin_id = auth.uid() OR 
    is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can add managed users"
  ON public.user_management FOR INSERT
  WITH CHECK (
    admin_id = auth.uid() AND 
    is_admin_or_super(auth.uid())
  );

CREATE POLICY "Admins can remove managed users"
  ON public.user_management FOR DELETE
  USING (
    admin_id = auth.uid() OR 
    is_super_admin(auth.uid())
  );

-- Shop access assignments policies
CREATE POLICY "Users can view shop assignments"
  ON public.shop_access_assignments FOR SELECT
  USING (
    member_id = auth.uid() OR 
    assigned_by = auth.uid() OR 
    is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can assign shop access"
  ON public.shop_access_assignments FOR INSERT
  WITH CHECK (
    assigned_by = auth.uid() AND 
    is_admin_or_super(auth.uid()) AND
    -- Admin can only assign shops they have admin access to
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shop_access_assignments.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

CREATE POLICY "Admins can update shop assignments"
  ON public.shop_access_assignments FOR UPDATE
  USING (
    assigned_by = auth.uid() OR 
    is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can remove shop assignments"
  ON public.shop_access_assignments FOR DELETE
  USING (
    assigned_by = auth.uid() OR 
    is_super_admin(auth.uid())
  );

-- Step 10: Update existing shop policies to include assigned access

-- Update shops SELECT policy to include assigned access
DROP POLICY IF EXISTS "Users can view shop data if they are members" ON public.shops;
CREATE POLICY "Users can view accessible shops"
  ON public.shops FOR SELECT
  USING (
    -- Direct membership
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shops.shop_id 
      AND sm.user_id = auth.uid()
    )
    OR
    -- Assigned access
    EXISTS (
      SELECT 1 FROM public.shop_access_assignments saa
      WHERE saa.shop_id = shops.shop_id 
      AND saa.member_id = auth.uid()
    )
  );

-- Members with assigned access cannot modify shops
DROP POLICY IF EXISTS "Only admins can delete shops" ON public.shops;
DROP POLICY IF EXISTS "Users can update shop tokens" ON public.shops;
DROP POLICY IF EXISTS "Only admins can update shop data" ON public.shops;

CREATE POLICY "Only direct admins can modify shops"
  ON public.shops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shops.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

CREATE POLICY "Only direct admins can delete shops"
  ON public.shops FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shops.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Step 11: Create views for easy management

-- View for user management dashboard
CREATE OR REPLACE VIEW user_management_dashboard AS
SELECT 
  p.id as user_id,
  p.email,
  p.full_name,
  p.avatar_url,
  r.name as role_name,
  r.display_name as role_display_name,
  p.created_at,
  p.updated_at,
  -- Count of shops user has access to
  (
    SELECT COUNT(DISTINCT shop_id) 
    FROM (
      SELECT shop_id FROM public.shop_members WHERE user_id = p.id
      UNION
      SELECT shop_id FROM public.shop_access_assignments WHERE member_id = p.id
    ) accessible_shops
  ) as accessible_shops_count,
  -- Admin who manages this user (if any)
  admin_p.full_name as managed_by_admin
FROM public.profiles p
INNER JOIN public.roles r ON p.role_id = r.id
LEFT JOIN public.user_management um ON p.id = um.member_id
LEFT JOIN public.profiles admin_p ON um.admin_id = admin_p.id;

-- View for shop access overview
CREATE OR REPLACE VIEW shop_access_overview AS
SELECT 
  s.shop_id,
  s.shop_name,
  s.region,
  -- Direct members count
  (SELECT COUNT(*) FROM public.shop_members WHERE shop_id = s.shop_id) as direct_members_count,
  -- Assigned members count  
  (SELECT COUNT(*) FROM public.shop_access_assignments WHERE shop_id = s.shop_id) as assigned_members_count,
  -- Admin info
  admin_p.full_name as admin_name,
  admin_p.email as admin_email
FROM public.shops s
LEFT JOIN public.shop_members admin_sm ON s.shop_id = admin_sm.shop_id AND admin_sm.role = 'admin'
LEFT JOIN public.profiles admin_p ON admin_sm.user_id = admin_p.id;

-- Step 12: Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_roles_updated_at ON public.roles;
CREATE TRIGGER trigger_update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_shop_access_assignments_updated_at ON public.shop_access_assignments;
CREATE TRIGGER trigger_update_shop_access_assignments_updated_at
  BEFORE UPDATE ON public.shop_access_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 13: Grant permissions
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.user_management TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_access_assignments TO authenticated;

GRANT SELECT ON user_management_dashboard TO authenticated;
GRANT SELECT ON shop_access_overview TO authenticated;

GRANT EXECUTE ON FUNCTION get_default_member_role_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_system_role TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin_or_super TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_managed_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_member_accessible_shops TO authenticated;

-- Step 14: Add helpful comments
COMMENT ON TABLE public.roles IS 'System-wide roles: super_admin, admin, member';
COMMENT ON TABLE public.user_management IS 'Admin-Member relationships for user management';
COMMENT ON TABLE public.shop_access_assignments IS 'Shop access assignments by admins to members';

COMMENT ON FUNCTION get_user_system_role IS 'Get user system role (super_admin, admin, member)';
COMMENT ON FUNCTION is_admin_or_super IS 'Check if user has admin or super admin privileges';
COMMENT ON FUNCTION is_super_admin IS 'Check if user is super admin';
COMMENT ON FUNCTION get_managed_users IS 'Get users managed by an admin';
COMMENT ON FUNCTION get_member_accessible_shops IS 'Get all shops accessible to a member';

COMMENT ON VIEW user_management_dashboard IS 'Dashboard view for user management';
COMMENT ON VIEW shop_access_overview IS 'Overview of shop access and members';

-- Step 15: Create sample data for testing (optional - remove in production)
-- This will create a super admin user if none exists
DO $$
DECLARE
  super_admin_role_id uuid;
BEGIN
  -- Get super_admin role id
  SELECT id INTO super_admin_role_id FROM public.roles WHERE name = 'super_admin';
  
  -- Update first user to be super admin if no super admin exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles p INNER JOIN public.roles r ON p.role_id = r.id WHERE r.name = 'super_admin') THEN
    UPDATE public.profiles 
    SET role_id = super_admin_role_id 
    WHERE id = (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1);
  END IF;
END $$;

COMMENT ON MIGRATION IS 'Enhanced User Management: Hierarchical role system with Super Admin > Admin > Member (Fixed)';