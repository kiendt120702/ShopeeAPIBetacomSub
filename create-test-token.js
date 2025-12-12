/**
 * Script tạo token test trong database
 */

const SUPABASE_URL = 'https://omgvvnqwroypavmpwbup.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZ3Z2bnF3cm95cGF2bXB3YnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzI2MjQsImV4cCI6MjA4MDg0ODYyNH0.7ykFYPTivbBni2HtnaSct2tAKDs9_kNNWTVulii1sIE';

async function createTestToken() {
  console.log('🔧 Creating test token in database...\n');

  const userId = 'cc316c20-7306-478e-8305-9d897c12b563';
  const shopId = 594424281;

  // Create test token in user_shops table
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_shops`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        shop_id: shopId,
        access_token: 'test_access_token_' + Date.now(),
        refresh_token: 'test_refresh_token_' + Date.now(),
        token_expired_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        is_active: true,
        updated_at: new Date().toISOString(),
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test token created in user_shops:', result);
    } else {
      const error = await response.text();
      console.log('❌ Failed to create token in user_shops:', error);
    }
  } catch (error) {
    console.log('💥 Exception creating token:', error.message);
  }
}

createTestToken().catch(console.error);