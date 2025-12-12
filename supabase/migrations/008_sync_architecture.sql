-- Migration: Kiến trúc Sync mới
-- Frontend chỉ đọc từ DB, Backend (Edge Functions) sync từ Shopee API

-- ============================================
-- 1. BẢNG SYNC STATUS - Theo dõi trạng thái sync của mỗi shop
-- ============================================
CREATE TABLE IF NOT EXISTS sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Sync timestamps cho từng loại data
  campaigns_synced_at TIMESTAMPTZ,
  flash_sales_synced_at TIMESTAMPTZ,
  shop_performance_synced_at TIMESTAMPTZ,
  orders_synced_at TIMESTAMPTZ,
  products_synced_at TIMESTAMPTZ,
  
  -- Sync status
  is_syncing BOOLEAN DEFAULT false,
  last_sync_error TEXT,
  
  -- Auto sync settings
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INT DEFAULT 5,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_status_shop_user ON sync_status(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_auto_sync ON sync_status(auto_sync_enabled) WHERE auto_sync_enabled = true;

-- ============================================
-- 2. BẢNG SHOP PERFORMANCE DATA
-- ============================================
CREATE TABLE IF NOT EXISTS shop_performance_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Overall performance
  rating INT,
  fulfillment_failed INT DEFAULT 0,
  listing_failed INT DEFAULT 0,
  custom_service_failed INT DEFAULT 0,
  
  -- Raw response backup
  raw_response JSONB,
  
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_performance_shop_user ON shop_performance_data(shop_id, user_id);

-- ============================================
-- 3. BẢNG SHOP METRICS DATA (Chi tiết từng metric)
-- ============================================
CREATE TABLE IF NOT EXISTS shop_metrics_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  metric_id INT NOT NULL,
  metric_name TEXT,
  metric_type INT,
  parent_metric_id INT,
  
  current_period DECIMAL(15,4),
  last_period DECIMAL(15,4),
  unit INT,
  
  target_value DECIMAL(15,4),
  target_comparator TEXT,
  is_passing BOOLEAN DEFAULT false,
  
  exemption_end_date TEXT,
  
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shop_id, user_id, metric_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_metrics_shop_user ON shop_metrics_data(shop_id, user_id);

-- ============================================
-- 4. BẢNG ADS CAMPAIGN DATA
-- ============================================
CREATE TABLE IF NOT EXISTS ads_campaign_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  campaign_id BIGINT NOT NULL,
  ad_type TEXT, -- 'auto' | 'manual'
  name TEXT,
  status TEXT, -- 'ongoing', 'paused', 'scheduled', 'ended', 'deleted', 'closed'
  
  campaign_placement TEXT,
  bidding_method TEXT,
  campaign_budget DECIMAL(15,2) DEFAULT 0,
  start_time BIGINT,
  end_time BIGINT,
  item_count INT DEFAULT 0,
  
  roas_target DECIMAL(5,2),
  raw_response JSONB,
  
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shop_id, user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_campaign_shop_user ON ads_campaign_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_status ON ads_campaign_data(status);

-- ============================================
-- 5. BẢNG FLASH SALE DATA
-- ============================================
CREATE TABLE IF NOT EXISTS flash_sale_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  flash_sale_id BIGINT NOT NULL,
  timeslot_id BIGINT,
  status INT,
  start_time BIGINT,
  end_time BIGINT,
  
  enabled_item_count INT DEFAULT 0,
  item_count INT DEFAULT 0,
  type INT, -- 1: upcoming, 2: ongoing, 3: ended
  
  remindme_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  
  raw_response JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(shop_id, user_id, flash_sale_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_shop_user ON flash_sale_data(shop_id, user_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_type ON flash_sale_data(type);

-- ============================================
-- 6. BẢNG SYNC JOBS (Queue cho background sync)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  job_type TEXT NOT NULL, -- 'campaigns', 'flash_sales', 'shop_performance', 'all'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  priority INT DEFAULT 5, -- 1 = highest, 10 = lowest
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  processed_items INT DEFAULT 0,
  total_items INT DEFAULT 0,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_sync_jobs_next_run ON sync_jobs(next_run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sync_jobs_shop_user ON sync_jobs(shop_id, user_id);

-- ============================================
-- 7. RLS POLICIES
-- ============================================

-- Sync Status
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync status" ON sync_status
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own sync status" ON sync_status
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sync status" ON sync_status
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Shop Performance Data
ALTER TABLE shop_performance_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shop performance" ON shop_performance_data
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage shop performance" ON shop_performance_data
  FOR ALL USING (true) WITH CHECK (true);

-- Shop Metrics Data
ALTER TABLE shop_metrics_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shop metrics" ON shop_metrics_data
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage shop metrics" ON shop_metrics_data
  FOR ALL USING (true) WITH CHECK (true);

-- Ads Campaign Data
ALTER TABLE ads_campaign_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON ads_campaign_data
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage campaigns" ON ads_campaign_data
  FOR ALL USING (true) WITH CHECK (true);

-- Flash Sale Data
ALTER TABLE flash_sale_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flash sales" ON flash_sale_data
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage flash sales" ON flash_sale_data
  FOR ALL USING (true) WITH CHECK (true);

-- Sync Jobs
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync jobs" ON sync_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create sync jobs" ON sync_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage sync jobs" ON sync_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Auto update updated_at (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_sync_status_updated_at ON sync_status;
DROP TRIGGER IF EXISTS update_sync_jobs_updated_at ON sync_jobs;

CREATE TRIGGER update_sync_status_updated_at
  BEFORE UPDATE ON sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sync_jobs_updated_at
  BEFORE UPDATE ON sync_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. FUNCTION: Tạo sync status khi user kết nối shop mới
-- ============================================
CREATE OR REPLACE FUNCTION create_sync_status_on_shop_connect()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sync_status (shop_id, user_id, auto_sync_enabled)
  VALUES (NEW.shop_id, NEW.user_id, true)
  ON CONFLICT (shop_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger khi insert vào user_shops
DROP TRIGGER IF EXISTS trigger_create_sync_status ON user_shops;
CREATE TRIGGER trigger_create_sync_status
  AFTER INSERT ON user_shops
  FOR EACH ROW EXECUTE FUNCTION create_sync_status_on_shop_connect();

-- ============================================
-- 10. REALTIME SUBSCRIPTIONS
-- ============================================
-- Enable realtime for sync tables (ignore errors if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_status;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shop_performance_data;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE shop_metrics_data;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ads_campaign_data;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE flash_sale_data;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sync_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
