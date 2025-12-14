-- Migration: Final Schema Consolidation
-- This migration addresses two major issues:
-- 1. Remove shopee_tokens table (duplicate with shops table)
-- 2. Remove partners table (duplicate with partner_accounts table)

-- Step 1: Ensure shops table has all necessary columns
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS expire_in integer DEFAULT 14400,
ADD COLUMN IF NOT EXISTS token_updated_at timestamp with time zone;

-- Step 2: Migrate any missing data from shopee_tokens to shops (if exists)
DO $$
BEGIN
  -- Check if shopee_tokens table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shopee_tokens') THEN
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
  END IF;
END $$;

-- Step 3: Update user_shops to reference partner_accounts instead of partners (if needed)
DO $$
BEGIN
  -- Check if partners table exists and update references
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'partners') THEN
    UPDATE user_shops 
    SET partner_id = pa.partner_id
    FROM partner_accounts pa, partners p
    WHERE user_shops.partner_id = p.partner_id 
      AND p.partner_id = pa.partner_id
      AND user_shops.partner_id IS NOT NULL;
  END IF;
END $$;

-- Step 4: Update shops table to use partner_account_id properly
DO $$
BEGIN
  -- Ensure all shops have proper partner_account_id reference
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'partner_id') THEN
    UPDATE shops 
    SET partner_account_id = pa.id
    FROM partner_accounts pa
    WHERE shops.partner_id = pa.partner_id
      AND shops.partner_account_id IS NULL;
  END IF;
END $$;

-- Step 5: Drop foreign key constraints that reference tables we're about to drop
ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_partner_id_fkey;

-- Step 6: Drop the duplicate tables if they exist
DROP TABLE IF EXISTS shopee_tokens CASCADE;
DROP TABLE IF EXISTS partners CASCADE;

-- Step 7: Clean up shops table - remove redundant columns
ALTER TABLE shops 
DROP COLUMN IF EXISTS partner_id,
DROP COLUMN IF EXISTS partner_key;

-- Step 8: Ensure partner_account_id is properly set up
-- Add partner_account_id column if it doesn't exist
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS partner_account_id uuid;

-- For existing shops without partner_account_id, create a default partner account
DO $$
DECLARE
  default_partner_id uuid;
BEGIN
  -- Check if there are shops without partner_account_id
  IF EXISTS (SELECT 1 FROM shops WHERE partner_account_id IS NULL LIMIT 1) THEN
    -- Create a default partner account if none exists
    INSERT INTO partner_accounts (partner_id, partner_key, name, description, is_active)
    VALUES (
      COALESCE((SELECT partner_id FROM partner_accounts LIMIT 1), 1000000),
      COALESCE((SELECT partner_key FROM partner_accounts LIMIT 1), 'default_key'),
      'Default Partner Account',
      'Auto-created during schema consolidation',
      true
    )
    ON CONFLICT (partner_id) DO NOTHING
    RETURNING id INTO default_partner_id;
    
    -- Get the default partner account ID
    SELECT id INTO default_partner_id FROM partner_accounts LIMIT 1;
    
    -- Update shops without partner_account_id
    UPDATE shops 
    SET partner_account_id = default_partner_id
    WHERE partner_account_id IS NULL;
  END IF;
END $$;

-- Step 9: Add proper constraints and indexes
-- Make partner_account_id required only if there are partner accounts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM partner_accounts LIMIT 1) THEN
    ALTER TABLE shops 
    ALTER COLUMN partner_account_id SET NOT NULL;
  END IF;
END $$;

-- Add foreign key constraint
ALTER TABLE shops 
ADD CONSTRAINT shops_partner_account_id_fkey 
FOREIGN KEY (partner_account_id) REFERENCES partner_accounts(id)
ON DELETE SET NULL;

-- Step 10: Update user_shops table structure
-- Remove partner_id column as it's now handled through shops -> partner_accounts
ALTER TABLE user_shops 
DROP COLUMN IF EXISTS partner_id;

-- Step 11: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shops_partner_account_id ON shops(partner_account_id);
CREATE INDEX IF NOT EXISTS idx_shops_expired_at ON shops(expired_at);
CREATE INDEX IF NOT EXISTS idx_user_shops_shop_id ON user_shops(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_shops_user_id ON user_shops(user_id);

-- Step 12: Add token history table for audit purposes
CREATE TABLE IF NOT EXISTS token_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id bigint NOT NULL,
  old_access_token text,
  new_access_token text NOT NULL,
  old_refresh_token text,
  new_refresh_token text NOT NULL,
  old_expired_at bigint,
  new_expired_at bigint NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  reason text DEFAULT 'update'
);

-- Add foreign key constraint for token_logs (soft reference, no CASCADE)
-- We don't add FK constraint to avoid issues if shop is deleted
CREATE INDEX IF NOT EXISTS idx_token_logs_shop_id ON token_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_token_logs_changed_at ON token_logs(changed_at);

-- Step 13: Create function to log token changes
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

-- Step 14: Create view for easier querying
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
LEFT JOIN partner_accounts pa ON s.partner_account_id = pa.id;

-- Step 15: Add comments for documentation
COMMENT ON TABLE shops IS 'Main shops table containing all shop information including tokens';
COMMENT ON TABLE partner_accounts IS 'Partner accounts created by users with their partner keys';
COMMENT ON TABLE user_shops IS 'Many-to-many relationship between users and shops';
COMMENT ON TABLE token_logs IS 'Audit log for token changes';
COMMENT ON VIEW shop_details IS 'Consolidated view of shop and partner information';

-- Step 16: Update RLS policies if needed
-- Enable RLS on token_logs
ALTER TABLE token_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for token_logs (users can only see logs for their shops)
DROP POLICY IF EXISTS "Users can view token logs for their shops" ON token_logs;
CREATE POLICY "Users can view token logs for their shops"
  ON token_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_shops us 
      WHERE us.shop_id = token_logs.shop_id 
      AND us.user_id = auth.uid()
    )
  );

-- Ensure shops RLS allows token updates
DROP POLICY IF EXISTS "Users can update shop tokens" ON shops;
CREATE POLICY "Users can update shop tokens"
  ON shops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_shops us 
      WHERE us.shop_id = shops.shop_id 
      AND us.user_id = auth.uid()
    )
  );

COMMENT ON MIGRATION IS 'Final schema consolidation: Remove duplicate tables (shopee_tokens, partners) and consolidate into shops and partner_accounts';