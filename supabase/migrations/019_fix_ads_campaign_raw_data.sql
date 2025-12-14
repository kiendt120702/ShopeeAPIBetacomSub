-- Migration: Add raw_data column to ads_campaign_data
-- Fixes: "Could not find the 'raw_data' column of 'ads_campaign_data' in the schema cache"

-- Add raw_data column if not exists (used by frontend ads-client.ts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ads_campaign_data' AND column_name = 'raw_data'
  ) THEN
    ALTER TABLE ads_campaign_data ADD COLUMN raw_data JSONB;
    COMMENT ON COLUMN ads_campaign_data.raw_data IS 'Raw response data from Shopee API (frontend)';
  END IF;
END $$;

-- Sync worker uses raw_response, so we need to handle both
-- If raw_response exists but raw_data doesn't, copy data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ads_campaign_data' AND column_name = 'raw_response'
  ) THEN
    -- Copy raw_response to raw_data where raw_data is null
    UPDATE ads_campaign_data SET raw_data = raw_response WHERE raw_data IS NULL AND raw_response IS NOT NULL;
  END IF;
END $$;
