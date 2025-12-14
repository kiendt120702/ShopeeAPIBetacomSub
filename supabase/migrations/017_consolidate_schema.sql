-- Migration: Consolidate Schema - Remove Duplicate Tables
-- This migration addresses two major issues:
-- 1. Remove shopee_tokens table (duplicate with shops table)
-- 2. Remove partners table (duplicate with partner_accounts table)

-- Step 1: Migrate any missing data from shopee_tokens to shops
-- Update shops table with token data from shopee_tokens if shops.access_token is null
UPDATE shops 
SET 
  access_token = st.access_token,
  refresh_token = st.refresh_token,
  expired_at = st.expired_at,
  expire_in = st.expire_in,
  merchant_id = COALESCE(shops.merchant_id, st.merchant_id),
  token_updated_at = st.updated_at
FROM shopee_tokens st
WHERE shops.shop_id = st.shop_id
  AND (shops.access_token IS NULL OR shops.access_token = '');

-- Step 2: Update user_shops to reference partner_accounts instead of partners
-- First, create a mapping from partner_id to partner_account_id
UPDATE user_shops 
SET partner_id = pa.partner_id
FROM partner_accounts pa
WHERE user_shops.partner_id IS NULL;

-- Step 3: Update shops table to use partner_account_id properly
-- Ensure all shops have proper partner_account_id reference
UPDATE shops 
SET partner_account_id = pa.id
FROM partner_accounts pa
WHERE shops.partner_id = pa.partner_id
  AND shops.partner_account_id IS NULL;

-- Step 4: Drop foreign key constraints that reference tables we're about to drop
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_partner_id_fkey;

-- Step 5: Drop the duplicate tables
DROP TABLE IF EXISTS shopee_tokens;
DROP TABLE IF EXISTS partners;

-- Step 6: Clean up shops table - remove redundant columns
ALTER TABLE shops 
DROP COLUMN IF EXISTS partner_id,
DROP COLUMN IF EXISTS partner_key;

-- Step 7: Add proper constraints and indexes
-- Ensure partner_account_id is required
ALTER TABLE shops 
ALTER COLUMN partner_account_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE shops 
ADD CONSTRAINT shops_partner_account_id_fkey 
FOREIGN KEY (partner_account_id) REFERENCES partner_accounts(id);

-- Step 8: Update user_shops table structure
-- Remove partner_id column as it's now handled through shops -> partner_accounts
ALTER TABLE user_shops 
DROP COLUMN IF EXISTS partner_id;

-- Step 9: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shops_partner_account_id ON shops(partner_account_id);
CREATE INDEX IF NOT EXISTS idx_shops_expired_at ON shops(expired_at);
CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON user_shops(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_user_id ON user_shops(user_id);

-- Step 10: Add token history table for audit purposes (optional)
CREATE TABLE IF NOT EXISTS token_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id bigint NOT NULL REFERENCES shops(shop_id),
  old_access_token text,
  new_access_token text NOT NULL,
  old_refresh_token text,
  new_refresh_token text NOT NULL,
  old_expired_at bigint,
  new_expired_at bigint NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  reason text -- 'refresh', 'reauth', 'manual', etc.
);

CREATE INDEX IF NOT EXISTS idx_token_logs_shop_id ON token_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_token_logs_changed_at ON token_logs(changed_at);

-- Step 11: Create function to log token changes
CREATE OR REPLACE FUNCTION log_token_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if tokens actually changed
  IF OLD.access_token IS DISTINCT FROM NEW.access_token 
     OR OLD.refresh_token IS DISTINCT FROM NEW.refresh_token 
     OR OLD.expired_at IS DISTINCT FROM NEW.expired_at THEN
    
    INSERT INTO token_logs (
      shop_id,
      old_access_token,
      new_access_token,
      old_refresh_token,
      new_refresh_token,
      old_expired_at,
      new_expired_at,
      reason
    ) VALUES (
      NEW.shop_id,
      OLD.access_token,
      NEW.access_token,
      OLD.refresh_token,
      NEW.refresh_token,
      OLD.expired_at,
      NEW.expired_at,
      'update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for token logging
DROP TRIGGER IF EXISTS trigger_log_token_change ON shops;
CREATE TRIGGER trigger_log_token_change
  AFTER UPDATE ON shops
  FOR EACH ROW
  EXECUTE FUNCTION log_token_change();

-- Step 12: Add comments for documentation
COMMENT ON TABLE shops IS 'Main shops table containing all shop information including tokens';
COMMENT ON TABLE partner_accounts IS 'Partner accounts created by users with their partner keys';
COMMENT ON TABLE user_shops IS 'Many-to-many relationship between users and shops';
COMMENT ON TABLE token_logs IS 'Audit log for token changes';

-- Step 13: Create view for easier querying
CREATE OR REPLACE VIEW shop_details AS
SELECT 
  s.shop_id,
  s.shop_name,
  s.region,
  s.merchant_id,
  s.shop_logo,
  s.expired_at,
  s.expire_in,
  s.token_updated_at,
  s.created_at,
  s.updated_at,
  pa.partner_id,
  pa.partner_key,
  pa.name as partner_name,
  pa.description as partner_description,
  pa.is_active as partner_active
FROM shops s
JOIN partner_accounts pa ON s.partner_account_id = pa.id;

COMMENT ON VIEW shop_details IS 'Consolidated view of shop and partner information';