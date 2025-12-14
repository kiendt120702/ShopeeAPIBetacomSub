-- Fix: Thêm column cached_at vào bảng ads_campaign_data
ALTER TABLE ads_campaign_data ADD COLUMN IF NOT EXISTS cached_at TIMESTAMPTZ DEFAULT NOW();

-- Tạo index cho cached_at
CREATE INDEX IF NOT EXISTS idx_ads_campaign_data_cached_at ON ads_campaign_data(cached_at);
