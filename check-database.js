/**
 * Script kiểm tra database
 */

const SUPABASE_URL = 'https://omgvvnqwroypavmpwbup.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZ3Z2bnF3cm95cGF2bXB3YnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzI2MjQsImV4cCI6MjA4MDg0ODYyNH0.7ykFYPTivbBni2HtnaSct2tAKDs9_kNNWTVulii1sIE';

async function checkDatabase() {
  console.log('🔍 Checking database tables...\n');

  const userId = 'cc316c20-7306-478e-8305-9d897c12b563';
  const shopId = 594424281;

  // Check user_shops table
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_shops?shop_id=eq.${shopId}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    const userShops = await response.json();
    console.log('📊 user_shops table:', userShops);
  } catch (error) {
    console.log('❌ Error checking user_shops:', error.message);
  }

  // Check shopee_tokens table
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shopee_tokens?shop_id=eq.${shopId}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    const tokens = await response.json();
    console.log('🔑 shopee_tokens table:', tokens);
  } catch (error) {
    console.log('❌ Error checking shopee_tokens:', error.message);
  }

  // Check flash_sale_data table
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/flash_sale_data?shop_id=eq.${shopId}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    const flashSales = await response.json();
    console.log('⚡ flash_sale_data table:', flashSales);
  } catch (error) {
    console.log('❌ Error checking flash_sale_data:', error.message);
  }

  // Check ads_campaign_data table
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ads_campaign_data?shop_id=eq.${shopId}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });

    const campaigns = await response.json();
    console.log('📢 ads_campaign_data table:', campaigns);
  } catch (error) {
    console.log('❌ Error checking ads_campaign_data:', error.message);
  }
}

checkDatabase().catch(console.error);