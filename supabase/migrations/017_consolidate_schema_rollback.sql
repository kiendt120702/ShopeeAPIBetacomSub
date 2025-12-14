-- Rollback Migration: Restore Original Schema Structure
-- WARNING: This rollback may result in data loss if executed after the main migration
-- Only use this if you need to revert immediately after running the consolidation

-- Step 1: Drop the new structures
DROP TRIGGER IF EXISTS trigger_log_token_change ON shops;
DROP FUNCTION IF EXISTS log_token_change();
DROP TABLE IF EXISTS token_logs;
DROP VIEW IF EXISTS shop_details;

-- Step 2: Recreate partners table
CREATE TABLE partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id bigint UNIQUE NOT NULL,
  partner_key text NOT NULL,
  partner_name text,
  region text DEFAULT 'VN',
  base_url text DEFAULT 'https://partner.shopeemobile.com',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 3: Recreate shopee_tokens table
CREATE TABLE shopee_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id bigint UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expire_in integer NOT NULL,
  expired_at bigint NOT NULL,
  merchant_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 4: Restore shops table structure
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS partner_id bigint,
ADD COLUMN IF NOT EXISTS partner_key text;

-- Step 5: Migrate data back from consolidated structure
-- Populate partners table from partner_accounts
INSERT INTO partners (partner_id, partner_key, partner_name, is_active, created_at, updated_at)
SELECT 
  partner_id,
  partner_key,
  name,
  is_active,
  created_at,
  updated_at
FROM partner_accounts;

-- Populate shopee_tokens from shops
INSERT INTO shopee_tokens (shop_id, access_token, refresh_token, expire_in, expired_at, merchant_id, created_at, updated_at)
SELECT 
  shop_id,
  access_token,
  refresh_token,
  COALESCE(expire_in, 14400),
  expired_at,
  merchant_id,
  created_at,
  COALESCE(token_updated_at, updated_at)
FROM shops
WHERE access_token IS NOT NULL;

-- Update shops with partner_id
UPDATE shops 
SET partner_id = pa.partner_id,
    partner_key = pa.partner_key
FROM partner_accounts pa
WHERE shops.partner_account_id = pa.id;

-- Step 6: Restore original constraints
ALTER TABLE shops 
ADD CONSTRAINT shops_partner_id_fkey 
FOREIGN KEY (partner_id) REFERENCES partners(partner_id);

-- Step 7: Add partner_id back to user_shops
ALTER TABLE user_shops 
ADD COLUMN IF NOT EXISTS partner_id bigint;

UPDATE user_shops 
SET partner_id = s.partner_id
FROM shops s
WHERE user_shops.shop_id = s.shop_id;

-- Step 8: Remove the consolidated columns/constraints
ALTER TABLE shops 
DROP CONSTRAINT IF EXISTS shops_partner_account_id_fkey,
ALTER COLUMN partner_account_id DROP NOT NULL;

-- Note: We don't drop partner_account_id column to avoid data loss
-- You can manually drop it later if needed

COMMENT ON TABLE partners IS 'Restored: Original partners table';
COMMENT ON TABLE shopee_tokens IS 'Restored: Original shopee tokens table';