-- Migration: Thêm bảng partner_accounts để hỗ trợ multi-partner/multi-shop
-- Chỉ admin được quản lý partner accounts
-- User được phân quyền vào shop thông qua user_shops

-- ============================================
-- 1. TẠO BẢNG PARTNER_ACCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS partner_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id BIGINT NOT NULL UNIQUE,
  partner_key TEXT NOT NULL,  -- Sẽ encrypt sau nếu cần
  name TEXT,                   -- Tên hiển thị (VD: "Partner chính", "Partner test")
  description TEXT,            -- Mô tả thêm
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_partner_accounts_partner_id ON partner_accounts(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_accounts_is_active ON partner_accounts(is_active);

-- ============================================
-- 2. LIÊN KẾT SHOPS VỚI PARTNER_ACCOUNTS
-- ============================================

-- Thêm FK từ shops → partner_accounts
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS partner_account_id UUID REFERENCES partner_accounts(id);

-- Index cho FK
CREATE INDEX IF NOT EXISTS idx_shops_partner_account_id ON shops(partner_account_id);

-- ============================================
-- 3. ENABLE RLS CHO PARTNER_ACCOUNTS
-- ============================================

ALTER TABLE partner_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES CHO PARTNER_ACCOUNTS
-- ============================================

-- SELECT: Chỉ admin/super_admin được xem
CREATE POLICY "partner_accounts_select_admin" ON partner_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
  );

-- INSERT: Chỉ admin/super_admin được tạo
CREATE POLICY "partner_accounts_insert_admin" ON partner_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
  );

-- UPDATE: Chỉ admin/super_admin được sửa
CREATE POLICY "partner_accounts_update_admin" ON partner_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
  );

-- DELETE: Chỉ super_admin được xóa (an toàn hơn)
CREATE POLICY "partner_accounts_delete_super_admin" ON partner_accounts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
  );

-- ============================================
-- 5. TRIGGER CHO updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_partner_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_partner_accounts_updated_at ON partner_accounts;
CREATE TRIGGER trigger_partner_accounts_updated_at
  BEFORE UPDATE ON partner_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_accounts_updated_at();

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_accounts TO authenticated;

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function lấy partner credentials cho shop
CREATE OR REPLACE FUNCTION get_partner_for_shop(p_shop_id BIGINT)
RETURNS TABLE (
  partner_id BIGINT,
  partner_key TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pa.partner_id, pa.partner_key
  FROM shops s
  JOIN partner_accounts pa ON s.partner_account_id = pa.id
  WHERE s.shop_id = p_shop_id
    AND pa.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function kiểm tra user có quyền truy cập shop không
CREATE OR REPLACE FUNCTION user_can_access_shop(p_user_id UUID, p_shop_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_shops 
    WHERE user_id = p_user_id 
      AND shop_id = p_shop_id 
      AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_partner_for_shop(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_access_shop(UUID, BIGINT) TO authenticated;

-- ============================================
-- 8. COMMENTS
-- ============================================

COMMENT ON TABLE partner_accounts IS 'Lưu trữ Shopee Partner credentials - chỉ admin quản lý';
COMMENT ON COLUMN partner_accounts.partner_id IS 'Shopee Partner ID';
COMMENT ON COLUMN partner_accounts.partner_key IS 'Shopee Partner Key (secret)';
COMMENT ON COLUMN partner_accounts.name IS 'Tên hiển thị của partner account';
COMMENT ON COLUMN partner_accounts.is_active IS 'Partner account có đang active không';
COMMENT ON COLUMN shops.partner_account_id IS 'FK đến partner_accounts - shop thuộc partner nào';
