-- Fix: Thêm column expire_in vào bảng shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS expire_in INTEGER DEFAULT 14400;
