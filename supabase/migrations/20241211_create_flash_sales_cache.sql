-- Create flash_sales_cache table for caching Flash Sale data
CREATE TABLE IF NOT EXISTS flash_sales_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  flash_sale_id BIGINT NOT NULL,
  timeslot_id BIGINT NOT NULL,
  status INTEGER NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  enabled_item_count INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  type INTEGER NOT NULL,
  remindme_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  raw_data JSONB,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(shop_id, flash_sale_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_flash_sales_cache_shop_id ON flash_sales_cache(shop_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_cache_type ON flash_sales_cache(type);
CREATE INDEX IF NOT EXISTS idx_flash_sales_cache_cached_at ON flash_sales_cache(cached_at);

-- Enable RLS (Row Level Security)
ALTER TABLE flash_sales_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all operations for now, can be restricted later)
CREATE POLICY "Allow all operations on flash_sales_cache" ON flash_sales_cache
  FOR ALL USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_flash_sales_cache_updated_at 
  BEFORE UPDATE ON flash_sales_cache 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();