/**
 * Test script để kiểm tra Edge Functions
 * Chạy: node test-edge-functions.js
 */

const SUPABASE_URL = 'https://omgvvnqwroypavmpwbup.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZ3Z2bnF3cm95cGF2bXB3YnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzI2MjQsImV4cCI6MjA4MDg0ODYyNH0.7ykFYPTivbBni2HtnaSct2tAKDs9_kNNWTVulii1sIE';

async function testEdgeFunction(functionName, payload) {
  console.log(`\n🧪 Testing ${functionName}...`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${functionName} - Success:`, result);
    } else {
      console.log(`❌ ${functionName} - Error:`, result);
    }
  } catch (error) {
    console.log(`💥 ${functionName} - Exception:`, error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing Edge Functions...\n');

  // Test Shopee API - Shop Performance (skip - need real user ID)
  // await testEdgeFunction('shopee-api', {
  //   action: 'get-shop-performance',
  //   shop_id: 594424281,
  //   user_id: 'test-user-id'
  // });

  // Test table existence (after migration)
  await testEdgeFunction('shopee-api', {
    action: 'get-flash-sale-data',
    shop_id: 594424281,
    user_id: '00000000-0000-0000-0000-000000000000' // Valid UUID format
  });

  await testEdgeFunction('shopee-api', {
    action: 'get-ads-campaign-data',
    shop_id: 594424281,
    user_id: '00000000-0000-0000-0000-000000000000' // Valid UUID format
  });

  // Test Sync Worker - Shop Performance
  await testEdgeFunction('shopee-sync-worker', {
    action: 'sync-shop-performance',
    shop_id: 594424281,
    user_id: 'test-user-id'
  });

  // Test Sync Worker - Flash Sale (with real user ID from logs)
  await testEdgeFunction('shopee-sync-worker', {
    action: 'sync-flash-sale-data',
    shop_id: 594424281,
    user_id: 'cc316c20-7306-478e-8305-9d897c12b563' // Real user ID from logs
  });

  // Test Sync Worker - Ads Campaign (with real user ID from logs)
  await testEdgeFunction('shopee-sync-worker', {
    action: 'sync-ads-campaign-data',
    shop_id: 594424281,
    user_id: 'cc316c20-7306-478e-8305-9d897c12b563' // Real user ID from logs
  });

  console.log('\n✨ Test completed!');
}

runTests().catch(console.error);