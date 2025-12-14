-- Migration: Fix ads_campaign_data unique constraint
-- Date: 2024-12-14
-- Description: Add unique constraint for upsert to work

-- Add unique constraint on (shop_id, campaign_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ads_campaign_data_shop_campaign_unique'
  ) THEN
    ALTER TABLE ads_campaign_data 
    ADD CONSTRAINT ads_campaign_data_shop_campaign_unique 
    UNIQUE (shop_id, campaign_id);
  END IF;
END $$;

-- Also fix flash_sale_data if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'flash_sale_data_shop_flash_sale_unique'
  ) THEN
    ALTER TABLE flash_sale_data 
    ADD CONSTRAINT flash_sale_data_shop_flash_sale_unique 
    UNIQUE (shop_id, flash_sale_id);
  END IF;
END $$;
