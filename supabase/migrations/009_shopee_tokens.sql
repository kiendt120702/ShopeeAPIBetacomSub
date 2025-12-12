-- Migration: Create shopee_tokens table for secure token storage
-- Theo docs/guides/token-storage.md - Database Storage pattern

-- Create shopee_tokens table
CREATE TABLE IF NOT EXISTS shopee_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expire_in INTEGER NOT NULL DEFAULT 14400,
  expired_at BIGINT,
  merchant_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one token per shop per user
  CONSTRAINT unique_shop_user UNIQUE (shop_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopee_tokens_shop_id ON shopee_tokens(shop_id);
CREATE INDEX IF NOT EXISTS idx_shopee_tokens_user_id ON shopee_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_shopee_tokens_expired_at ON shopee_tokens(expired_at);

-- Enable RLS
ALTER TABLE shopee_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own tokens
CREATE POLICY "Users can view own tokens"
  ON shopee_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON shopee_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON shopee_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON shopee_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_shopee_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_shopee_tokens_updated_at ON shopee_tokens;
CREATE TRIGGER trigger_shopee_tokens_updated_at
  BEFORE UPDATE ON shopee_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_shopee_tokens_updated_at();

-- Function to get valid token (not expired)
CREATE OR REPLACE FUNCTION get_valid_shopee_token(
  p_shop_id BIGINT,
  p_user_id UUID,
  p_buffer_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  access_token TEXT,
  refresh_token TEXT,
  expire_in INTEGER,
  expired_at BIGINT,
  shop_id BIGINT,
  merchant_id BIGINT,
  is_expired BOOLEAN
) AS $$
DECLARE
  buffer_ms BIGINT;
  current_ms BIGINT;
BEGIN
  buffer_ms := p_buffer_minutes * 60 * 1000;
  current_ms := EXTRACT(EPOCH FROM NOW()) * 1000;
  
  RETURN QUERY
  SELECT 
    t.access_token,
    t.refresh_token,
    t.expire_in,
    t.expired_at,
    t.shop_id,
    t.merchant_id,
    CASE 
      WHEN t.expired_at IS NULL THEN FALSE
      WHEN current_ms >= (t.expired_at - buffer_ms) THEN TRUE
      ELSE FALSE
    END as is_expired
  FROM shopee_tokens t
  WHERE t.shop_id = p_shop_id 
    AND t.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired tokens (for cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_shopee_tokens(
  p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_ms BIGINT;
BEGIN
  cutoff_ms := (EXTRACT(EPOCH FROM NOW()) - (p_days_old * 86400)) * 1000;
  
  DELETE FROM shopee_tokens
  WHERE expired_at IS NOT NULL 
    AND expired_at < cutoff_ms;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON shopee_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION get_valid_shopee_token TO authenticated;

COMMENT ON TABLE shopee_tokens IS 'Secure storage for Shopee OAuth tokens';
COMMENT ON COLUMN shopee_tokens.shop_id IS 'Shopee Shop ID';
COMMENT ON COLUMN shopee_tokens.access_token IS 'OAuth access token';
COMMENT ON COLUMN shopee_tokens.refresh_token IS 'OAuth refresh token';
COMMENT ON COLUMN shopee_tokens.expire_in IS 'Token expiry time in seconds';
COMMENT ON COLUMN shopee_tokens.expired_at IS 'Unix timestamp (ms) when token expires';
