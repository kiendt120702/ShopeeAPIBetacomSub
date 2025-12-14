-- Migration: User Management Policies and Functions
-- Additional policies and functions for complete user management system

-- Step 1: Update profiles table policies for role management
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Policy: Users can view profiles based on their role
CREATE POLICY "Role-based profile viewing"
  ON public.profiles FOR SELECT
  USING (
    -- Users can always view their own profile
    id = auth.uid()
    OR
    -- Super admins can view all profiles
    is_super_admin(auth.uid())
    OR
    -- Admins can view profiles of users they manage
    EXISTS (
      SELECT 1 FROM public.user_management um 
      WHERE um.admin_id = auth.uid() AND um.member_id = profiles.id
    )
  );

-- Policy: Role-based profile updates
CREATE POLICY "Role-based profile updates"
  ON public.profiles FOR UPDATE
  USING (
    -- Users can update their own basic info (not role)
    id = auth.uid()
    OR
    -- Super admins can update any profile
    is_super_admin(auth.uid())
    OR
    -- Admins can update profiles of users they manage (limited fields)
    (
      EXISTS (
        SELECT 1 FROM public.user_management um 
        WHERE um.admin_id = auth.uid() AND um.member_id = profiles.id
      )
      AND is_admin_or_super(auth.uid())
    )
  );

-- Step 2: Create function to safely update user roles
CREATE OR REPLACE FUNCTION update_user_role(
  p_user_id uuid,
  p_new_role_name text,
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS boolean AS $$
DECLARE
  new_role_id uuid;
  admin_role text;
  target_user_role text;
BEGIN
  -- Get admin's role
  SELECT get_user_system_role(p_admin_id) INTO admin_role;
  
  -- Get target user's current role
  SELECT get_user_system_role(p_user_id) INTO target_user_role;
  
  -- Get new role ID
  SELECT id INTO new_role_id FROM public.roles WHERE name = p_new_role_name;
  
  IF new_role_id IS NULL THEN
    RAISE EXCEPTION 'Invalid role name: %', p_new_role_name;
  END IF;
  
  -- Permission checks
  IF admin_role = 'super_admin' THEN
    -- Super admin can change any role
    NULL;
  ELSIF admin_role = 'admin' THEN
    -- Admin can only manage members and promote to admin
    IF target_user_role NOT IN ('member') OR p_new_role_name NOT IN ('member', 'admin') THEN
      RAISE EXCEPTION 'Insufficient permissions to change role from % to %', target_user_role, p_new_role_name;
    END IF;
    
    -- Admin must manage this user
    IF NOT EXISTS (
      SELECT 1 FROM public.user_management 
      WHERE admin_id = p_admin_id AND member_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'You can only change roles of users you manage';
    END IF;
  ELSE
    RAISE EXCEPTION 'Insufficient permissions to change user roles';
  END IF;
  
  -- Update the role
  UPDATE public.profiles 
  SET role_id = new_role_id, updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create function to add user to admin's management
CREATE OR REPLACE FUNCTION add_managed_user(
  p_member_email text,
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS uuid AS $$
DECLARE
  member_id uuid;
  admin_role text;
BEGIN
  -- Check if admin has permission
  SELECT get_user_system_role(p_admin_id) INTO admin_role;
  
  IF admin_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can manage users';
  END IF;
  
  -- Find user by email
  SELECT id INTO member_id FROM public.profiles WHERE email = p_member_email;
  
  IF member_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', p_member_email;
  END IF;
  
  -- Cannot manage yourself
  IF member_id = p_admin_id THEN
    RAISE EXCEPTION 'Cannot manage yourself';
  END IF;
  
  -- Insert management relationship
  INSERT INTO public.user_management (admin_id, member_id, created_by)
  VALUES (p_admin_id, member_id, p_admin_id)
  ON CONFLICT (admin_id, member_id) DO NOTHING;
  
  RETURN member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create function to assign shop access to member
CREATE OR REPLACE FUNCTION assign_shop_access(
  p_shop_id bigint,
  p_member_id uuid,
  p_access_level text DEFAULT 'read_only',
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS uuid AS $$
DECLARE
  assignment_id uuid;
BEGIN
  -- Check if admin has permission to this shop
  IF NOT is_shop_admin(p_shop_id, p_admin_id) AND NOT is_super_admin(p_admin_id) THEN
    RAISE EXCEPTION 'You must be admin of this shop to assign access';
  END IF;
  
  -- Check if admin manages this member (unless super admin)
  IF NOT is_super_admin(p_admin_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_management 
      WHERE admin_id = p_admin_id AND member_id = p_member_id
    ) THEN
      RAISE EXCEPTION 'You can only assign access to users you manage';
    END IF;
  END IF;
  
  -- Insert or update assignment
  INSERT INTO public.shop_access_assignments (shop_id, member_id, assigned_by, access_level)
  VALUES (p_shop_id, p_member_id, p_admin_id, p_access_level)
  ON CONFLICT (shop_id, member_id) 
  DO UPDATE SET 
    access_level = EXCLUDED.access_level,
    assigned_by = EXCLUDED.assigned_by,
    updated_at = now()
  RETURNING id INTO assignment_id;
  
  RETURN assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create function to remove shop access
CREATE OR REPLACE FUNCTION remove_shop_access(
  p_shop_id bigint,
  p_member_id uuid,
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS boolean AS $$
BEGIN
  -- Check permissions
  IF NOT is_shop_admin(p_shop_id, p_admin_id) AND NOT is_super_admin(p_admin_id) THEN
    RAISE EXCEPTION 'You must be admin of this shop to remove access';
  END IF;
  
  -- Remove assignment
  DELETE FROM public.shop_access_assignments 
  WHERE shop_id = p_shop_id 
    AND member_id = p_member_id 
    AND (assigned_by = p_admin_id OR is_super_admin(p_admin_id));
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create function to get shop members with access details
CREATE OR REPLACE FUNCTION get_shop_members_detailed(p_shop_id bigint)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  access_type text,
  role_or_level text,
  assigned_by_name text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  -- Direct members
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    'direct'::text as access_type,
    sm.role as role_or_level,
    NULL::text as assigned_by_name,
    sm.created_at
  FROM public.shop_members sm
  INNER JOIN public.profiles p ON sm.user_id = p.id
  WHERE sm.shop_id = p_shop_id
  
  UNION ALL
  
  -- Assigned members
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    'assigned'::text as access_type,
    saa.access_level as role_or_level,
    admin_p.full_name as assigned_by_name,
    saa.created_at
  FROM public.shop_access_assignments saa
  INNER JOIN public.profiles p ON saa.member_id = p.id
  LEFT JOIN public.profiles admin_p ON saa.assigned_by = admin_p.id
  WHERE saa.shop_id = p_shop_id
  
  ORDER BY access_type, created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Update data access policies for other tables
-- Update sync_jobs policies to include assigned access
DROP POLICY IF EXISTS "Users can view sync jobs for their shops" ON public.sync_jobs;
CREATE POLICY "Users can view sync jobs for accessible shops"
  ON public.sync_jobs FOR SELECT
  USING (
    -- Direct shop membership
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = sync_jobs.shop_id 
      AND sm.user_id = auth.uid()
    )
    OR
    -- Assigned shop access
    EXISTS (
      SELECT 1 FROM public.shop_access_assignments saa
      WHERE saa.shop_id = sync_jobs.shop_id 
      AND saa.member_id = auth.uid()
    )
  );

-- Only direct admins can modify sync jobs
DROP POLICY IF EXISTS "Users can manage sync jobs for their shops" ON public.sync_jobs;
CREATE POLICY "Only direct admins can manage sync jobs"
  ON public.sync_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = sync_jobs.shop_id 
      AND sm.user_id = auth.uid() 
      AND sm.role = 'admin'
    )
  );

-- Step 8: Update other data tables with similar patterns
-- Campaigns data
DROP POLICY IF EXISTS "Users can view campaign data for their shops" ON public.ads_campaign_data;
CREATE POLICY "Users can view campaign data for accessible shops"
  ON public.ads_campaign_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = ads_campaign_data.shop_id 
      AND sm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.shop_access_assignments saa
      WHERE saa.shop_id = ads_campaign_data.shop_id 
      AND saa.member_id = auth.uid()
    )
  );

-- Flash sale data
DROP POLICY IF EXISTS "Users can view flash sale data for their shops" ON public.flash_sale_data;
CREATE POLICY "Users can view flash sale data for accessible shops"
  ON public.flash_sale_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = flash_sale_data.shop_id 
      AND sm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.shop_access_assignments saa
      WHERE saa.shop_id = flash_sale_data.shop_id 
      AND saa.member_id = auth.uid()
    )
  );

-- Shop performance data
DROP POLICY IF EXISTS "Users can view shop performance for their shops" ON public.shop_performance_data;
CREATE POLICY "Users can view shop performance for accessible shops"
  ON public.shop_performance_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm 
      WHERE sm.shop_id = shop_performance_data.shop_id 
      AND sm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.shop_access_assignments saa
      WHERE saa.shop_id = shop_performance_data.shop_id 
      AND saa.member_id = auth.uid()
    )
  );

-- Step 9: Create admin dashboard functions
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats(p_admin_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  managed_users_count bigint,
  managed_shops_count bigint,
  total_shop_assignments bigint,
  recent_assignments_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.user_management WHERE admin_id = p_admin_id) as managed_users_count,
    (SELECT COUNT(DISTINCT sm.shop_id) 
     FROM public.shop_members sm 
     WHERE sm.user_id = p_admin_id AND sm.role = 'admin') as managed_shops_count,
    (SELECT COUNT(*) FROM public.shop_access_assignments WHERE assigned_by = p_admin_id) as total_shop_assignments,
    (SELECT COUNT(*) 
     FROM public.shop_access_assignments 
     WHERE assigned_by = p_admin_id 
     AND created_at >= now() - interval '7 days') as recent_assignments_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Grant permissions for new functions
GRANT EXECUTE ON FUNCTION update_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION add_managed_user TO authenticated;
GRANT EXECUTE ON FUNCTION assign_shop_access TO authenticated;
GRANT EXECUTE ON FUNCTION remove_shop_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_shop_members_detailed TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats TO authenticated;

-- Step 11: Add helpful comments
COMMENT ON FUNCTION update_user_role IS 'Safely update user role with permission checks';
COMMENT ON FUNCTION add_managed_user IS 'Add user to admin management by email';
COMMENT ON FUNCTION assign_shop_access IS 'Assign shop access to managed member';
COMMENT ON FUNCTION remove_shop_access IS 'Remove shop access from member';
COMMENT ON FUNCTION get_shop_members_detailed IS 'Get detailed shop member list with access info';
COMMENT ON FUNCTION get_admin_dashboard_stats IS 'Get admin dashboard statistics';

COMMENT ON MIGRATION IS 'User Management Policies: Complete role-based access control and management functions';