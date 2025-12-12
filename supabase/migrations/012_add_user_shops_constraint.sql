-- Migration: Add unique constraint for user_shops
-- Đảm bảo mỗi user chỉ liên kết 1 lần với mỗi shop

-- Thêm unique constraint cho user_shops (user_id + shop_id)
ALTER TABLE user_shops 
  DROP CONSTRAINT IF EXISTS user_shops_user_shop_unique;

ALTER TABLE user_shops 
  ADD CONSTRAINT user_shops_user_shop_unique 
  UNIQUE (user_id, shop_id);

-- Thêm index cho các query thường dùng
CREATE INDEX IF NOT EXISTS idx_user_shops_user_id ON user_shops(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON user_shops(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_active ON user_shops(user_id, is_active);

COMMENT ON CONSTRAINT user_shops_user_shop_unique ON user_shops IS 
  'Đảm bảo mỗi user chỉ liên kết 1 lần với mỗi shop';
