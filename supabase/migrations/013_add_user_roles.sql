-- Migration: Thêm hệ thống phân quyền user roles
-- Thêm role vào profiles và logic admin tự động

-- Enum cho user roles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

-- Thêm role column vào profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- Thêm column để track admin được tạo từ user có shop
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS promoted_from_user BOOLEAN DEFAULT FALSE;

-- Index cho role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Function để tự động promote user thành admin khi kết nối shop
CREATE OR REPLACE FUNCTION auto_promote_user_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Nếu user có shop và role hiện tại là 'user', promote thành admin
  IF NEW.shop_id IS NOT NULL AND NEW.is_active = TRUE THEN
    UPDATE profiles 
    SET 
      role = 'admin',
      promoted_from_user = TRUE,
      updated_at = NOW()
    WHERE id = NEW.user_id 
      AND role = 'user';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger để auto promote user khi thêm shop
DROP TRIGGER IF EXISTS trigger_auto_promote_admin ON user_shops;
CREATE TRIGGER trigger_auto_promote_admin
  AFTER INSERT OR UPDATE ON user_shops
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_user_to_admin();

-- Function để demote admin về user khi không còn shop active
CREATE OR REPLACE FUNCTION auto_demote_admin_to_user()
RETURNS TRIGGER AS $$
DECLARE
  active_shops_count INTEGER;
BEGIN
  -- Đếm số shop active còn lại của user
  SELECT COUNT(*) INTO active_shops_count
  FROM user_shops 
  WHERE user_id = OLD.user_id 
    AND is_active = TRUE 
    AND id != OLD.id; -- Loại trừ record đang bị xóa/deactivate
  
  -- Nếu không còn shop active và user được promote từ user, demote về user
  IF active_shops_count = 0 THEN
    UPDATE profiles 
    SET 
      role = 'user',
      promoted_from_user = FALSE,
      updated_at = NOW()
    WHERE id = OLD.user_id 
      AND role = 'admin' 
      AND promoted_from_user = TRUE;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger để auto demote admin khi xóa/deactivate shop
DROP TRIGGER IF EXISTS trigger_auto_demote_admin ON user_shops;
CREATE TRIGGER trigger_auto_demote_admin
  AFTER DELETE OR UPDATE ON user_shops
  FOR EACH ROW
  WHEN (OLD.is_active = TRUE AND (TG_OP = 'DELETE' OR NEW.is_active = FALSE))
  EXECUTE FUNCTION auto_demote_admin_to_user();

-- Cập nhật RLS policies cho profiles để admin có thể xem user
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Policy mới cho profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Cập nhật RLS policies cho user_shops để admin có thể xem tất cả
DROP POLICY IF EXISTS "Users can view own shops" ON user_shops;
DROP POLICY IF EXISTS "Users can insert own shops" ON user_shops;
DROP POLICY IF EXISTS "Users can update own shops" ON user_shops;
DROP POLICY IF EXISTS "Users can delete own shops" ON user_shops;

-- Policy mới cho user_shops
CREATE POLICY "Users can view own shops" ON user_shops
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user shops" ON user_shops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert own shops" ON user_shops
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shops" ON user_shops
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shops" ON user_shops
  FOR DELETE USING (auth.uid() = user_id);

-- Cập nhật RLS policies cho shops để admin có thể xem tất cả
DROP POLICY IF EXISTS "Users can view their shops" ON shops;
DROP POLICY IF EXISTS "Users can insert their shops" ON shops;
DROP POLICY IF EXISTS "Users can update their shops" ON shops;
DROP POLICY IF EXISTS "Users can delete their shops" ON shops;

-- Policy mới cho shops
CREATE POLICY "Users can view their shops" ON shops
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all shops" ON shops
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert their shops" ON shops
  FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their shops" ON shops
  FOR UPDATE USING (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete their shops" ON shops
  FOR DELETE USING (
    shop_id IN (SELECT shop_id FROM user_shops WHERE user_id = auth.uid())
  );

-- Function để check user role (helper function)
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID DEFAULT auth.uid())
RETURNS user_role AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM profiles
  WHERE id = user_uuid;
  
  RETURN COALESCE(user_role_result, 'user'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function để check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_uuid) IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;

-- Comments
COMMENT ON COLUMN profiles.role IS 'User role: user, admin, super_admin';
COMMENT ON COLUMN profiles.promoted_from_user IS 'True if admin was promoted from user role due to shop connection';
COMMENT ON FUNCTION auto_promote_user_to_admin() IS 'Auto promote user to admin when connecting shop';
COMMENT ON FUNCTION auto_demote_admin_to_user() IS 'Auto demote admin to user when no active shops';