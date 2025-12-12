-- Migration: Cleanup và tối ưu schema
-- Mục tiêu:
-- 1. user_shops: bỏ token fields (chỉ lưu quan hệ user-shop)
-- 2. shopee_tokens: shop_id là unique, bỏ user_id
-- 3. Xóa các bảng cache trùng lặp
-- 4. Tạo bảng sync_status đang thiếu

-- ============================================
-- 1. CLEANUP user_shops - bỏ token fields
-- ============================================

-- Thêm cột role nếu chưa có
ALTER TABLE user_shops ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';

-- Xóa các cột token không cần thiết
ALTER TABLE user_shops DROP COLUMN IF EXISTS access_token;
ALTER TABLE user_shops DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE user_shops DROP COLUMN IF EXISTS token_expired_at;

-- Thêm unique constraint cho user_id + shop_id
ALTER TABLE user_shops DROP CONSTRAINT IF EXISTS unique_user_shop;
ALTER TABLE user_shops ADD CONSTRAINT unique_user_shop UNIQUE (user_id, shop_id);

-- ============================================
-- 2. CLEANUP shopee_tokens - shop_id là unique
-- ============================================

-- Xóa RLS policies cũ TRƯỚC (vì chúng depend on user_id)
DROP POLICY IF EXISTS "Users can view own tokens" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON shopee_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON shopee_tokens;

-- Xóa user_id constraint và column
ALTER TABLE shopee_tokens DROP CONSTRAINT IF EXISTS shopee_tokens_user_id_fkey;
ALTER TABLE shopee_tokens DROP CONSTRAINT IF EXISTS unique_shop_user;

-- Xóa cột user_id
ALTER TABLE shopee_tokens DROP COLUMN IF EXISTS user_id;

-- Thêm unique constraint cho shop_id
ALTER TABLE shopee_tokens DROP CONSTRAINT IF EXISTS shopee_tokens_shop_id_key;
ALTER TABLE shopee_tokens ADD CONSTRAINT shopee_tokens_shop_id_key UNIQUE (shop_id);

-- Tạo RLS policies mới (dựa trên user_shops) - drop first to avoid conflicts
DROP POLICY IF EXISTS "Users can view tokens for their shops" ON shopee_tokens;
CREATE POLICY "Users can view tokens for their shops"
  ON shopee_tokens FOR SELECT
  USING (
    shop_id IN (
      SELECT us.shop_id FROM user_shops us WHERE us.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert tokens for their shops" ON shopee_tokens;
CREATE POLICY "Users can insert tokens for their shops"
  ON shopee_tokens FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT us.shop_id FROM user_shops us WHERE us.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update tokens for their shops" ON shopee_tokens;
CREATE POLICY "Users can update tokens for their shops"
  ON shopee_tokens FOR UPDATE
  USING (
    shop_id IN (
      SELECT us.shop_id FROM user_shops us WHERE us.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete tokens for their shops" ON shopee_tokens;
CREATE POLICY "Users can delete tokens for their shops"
  ON shopee_tokens FOR DELETE
  USING (
    shop_id IN (
      SELECT us.shop_id FROM user_shops us WHERE us.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. XÓA CÁC BẢNG CACHE TRÙNG LẶP
-- ============================================

-- Xóa campaigns_cache (dùng ads_campaign_data thay thế)
DROP TABLE IF EXISTS campaigns_cache;

-- Xóa flash_sales_cache (dùng flash_sale_data thay thế)
DROP TABLE IF EXISTS flash_sales_cache;

-- ============================================
-- 4. TẠO BẢNG sync_status ĐANG THIẾU
-- ============================================

CREATE TABLE IF NOT EXISTS sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Sync timestamps
  campaigns_synced_at TIMESTAMPTZ,
  flash_sales_synced_at TIMESTAMPTZ,
  shop_performance_synced_at TIMESTAMPTZ,
  shop_info_synced_at TIMESTAMPTZ,
  
  -- Sync state
  is_syncing BOOLEAN DEFAULT FALSE,
  auto_sync_enabled BOOLEAN DEFAULT TRUE,
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_sync_status UNIQUE (shop_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_status_shop_id ON sync_status(shop_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_user_id ON sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_auto_sync ON sync_status(auto_sync_enabled) WHERE auto_sync_enabled = TRUE;

-- Enable RLS
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own sync status" ON sync_status;
CREATE POLICY "Users can view own sync status"
  ON sync_status FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sync status" ON sync_status;
CREATE POLICY "Users can insert own sync status"
  ON sync_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sync status" ON sync_status;
CREATE POLICY "Users can update own sync status"
  ON sync_status FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sync status" ON sync_status;
CREATE POLICY "Users can delete own sync status"
  ON sync_status FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_status_updated_at ON sync_status;
CREATE TRIGGER trigger_sync_status_updated_at
  BEFORE UPDATE ON sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_status_updated_at();

-- ============================================
-- 5. THÊM UNIQUE CONSTRAINTS CHO DATA TABLES
-- ============================================

-- ads_campaign_data: unique per shop + campaign
ALTER TABLE ads_campaign_data DROP CONSTRAINT IF EXISTS unique_ads_campaign;
ALTER TABLE ads_campaign_data ADD CONSTRAINT unique_ads_campaign UNIQUE (shop_id, campaign_id);

-- flash_sale_data: unique per shop + flash_sale
ALTER TABLE flash_sale_data DROP CONSTRAINT IF EXISTS unique_flash_sale;
ALTER TABLE flash_sale_data ADD CONSTRAINT unique_flash_sale UNIQUE (shop_id, flash_sale_id);

-- shop_performance_data: unique per shop + user
ALTER TABLE shop_performance_data DROP CONSTRAINT IF EXISTS unique_shop_performance;
ALTER TABLE shop_performance_data ADD CONSTRAINT unique_shop_performance UNIQUE (shop_id, user_id);

-- shop_metrics_data: unique per shop + user + metric
ALTER TABLE shop_metrics_data DROP CONSTRAINT IF EXISTS unique_shop_metric;
ALTER TABLE shop_metrics_data ADD CONSTRAINT unique_shop_metric UNIQUE (shop_id, user_id, metric_id);

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON sync_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_shops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shopee_tokens TO authenticated;

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE user_shops IS 'Quan hệ Many-to-Many giữa users và shops';
COMMENT ON COLUMN user_shops.role IS 'Vai trò: owner, admin, staff';
COMMENT ON TABLE shopee_tokens IS 'OAuth tokens cho mỗi shop (1 shop = 1 token)';
COMMENT ON TABLE sync_status IS 'Trạng thái sync cho mỗi user-shop';
