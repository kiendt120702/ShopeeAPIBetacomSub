/**
 * Supabase Edge Function: Shopee Cron Sync
 * Run periodically to sync data for all shops
 * 
 * Configure Cron in Supabase Dashboard:
 * - Schedule: every 5 minutes
 * - HTTP Method: POST
 * - URL: https://[project].supabase.co/functions/v1/shopee-cron-sync
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Rate limit settings
const DELAY_BETWEEN_SHOPS = 2000; // 2 giây giữa mỗi shop
const MAX_SHOPS_PER_RUN = 10; // Tối đa 10 shops mỗi lần chạy

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[CRON] Starting scheduled sync...');

    // Lấy danh sách shops cần sync (sync_status cũ nhất)
    const { data: shopsToSync, error: fetchError } = await supabase
      .from('sync_status')
      .select('shop_id, user_id, campaigns_synced_at, flash_sales_synced_at')
      .eq('auto_sync_enabled', true)
      .eq('is_syncing', false)
      .order('campaigns_synced_at', { ascending: true, nullsFirst: true })
      .limit(MAX_SHOPS_PER_RUN);

    if (fetchError) {
      throw fetchError;
    }

    if (!shopsToSync || shopsToSync.length === 0) {
      console.log('[CRON] No shops to sync');
      return new Response(JSON.stringify({ message: 'No shops to sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[CRON] Found ${shopsToSync.length} shops to sync`);

    const results: any[] = [];
    const now = Date.now();
    const STALE_MINUTES = 5;

    for (const shop of shopsToSync) {
      try {
        // Mark as syncing
        await supabase
          .from('sync_status')
          .update({ is_syncing: true })
          .eq('shop_id', shop.shop_id)
          .eq('user_id', shop.user_id);

        const syncTasks: Promise<any>[] = [];

        // Check which data needs sync
        const campaignsStale = isStale(shop.campaigns_synced_at, STALE_MINUTES);
        const flashSalesStale = isStale(shop.flash_sales_synced_at, STALE_MINUTES);


        if (campaignsStale) {
          syncTasks.push(callSyncWorker(supabase, 'sync-ads-campaign-data', shop.shop_id, shop.user_id));
        }

        if (flashSalesStale) {
          syncTasks.push(callSyncWorker(supabase, 'sync-flash-sale-data', shop.shop_id, shop.user_id));
        }



        if (syncTasks.length > 0) {
          const taskResults = await Promise.allSettled(syncTasks);
          results.push({
            shop_id: shop.shop_id,
            tasks: taskResults.map((r, i) => ({
              task: ['campaigns', 'flash_sales', 'performance'][i],
              status: r.status,
              error: r.status === 'rejected' ? (r as PromiseRejectedResult).reason?.message : null,
            })),
          });
        }

        // Mark as not syncing
        await supabase
          .from('sync_status')
          .update({ is_syncing: false })
          .eq('shop_id', shop.shop_id)
          .eq('user_id', shop.user_id);

        // Delay between shops to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SHOPS));

      } catch (shopError) {
        console.error(`[CRON] Error syncing shop ${shop.shop_id}:`, shopError);
        
        // Update error status
        await supabase
          .from('sync_status')
          .update({ 
            is_syncing: false,
            last_sync_error: (shopError as Error).message,
          })
          .eq('shop_id', shop.shop_id)
          .eq('user_id', shop.user_id);

        results.push({
          shop_id: shop.shop_id,
          error: (shopError as Error).message,
        });
      }
    }

    console.log(`[CRON] Completed sync for ${results.length} shops`);

    return new Response(JSON.stringify({ 
      success: true, 
      shops_processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CRON] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function isStale(lastSyncedAt: string | null, staleMinutes: number): boolean {
  if (!lastSyncedAt) return true;
  const lastSync = new Date(lastSyncedAt).getTime();
  const now = Date.now();
  return (now - lastSync) > staleMinutes * 60 * 1000;
}

async function callSyncWorker(supabase: any, action: string, shopId: number, userId: string) {
  // Gọi sync worker function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/shopee-sync-worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ action, shop_id: shopId, user_id: userId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sync worker failed: ${error}`);
  }

  return response.json();
}
