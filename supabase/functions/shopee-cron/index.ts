/**
 * Supabase Edge Function: Shopee Cron
 * Scheduled job để tự động đồng bộ dữ liệu định kỳ
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Lấy danh sách shops cần sync (dữ liệu cũ hơn 4 giờ)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    const { data: shopsToSync, error } = await supabase
      .from('shopee_tokens')
      .select(`
        shop_id,
        user_id,
        shop_performance_data!left(synced_at)
      `)
      .or(`shop_performance_data.synced_at.is.null,shop_performance_data.synced_at.lt.${fourHoursAgo}`)
      .limit(10); // Giới hạn 10 shops mỗi lần chạy để tránh timeout

    if (error) {
      throw error;
    }

    console.log(`[CRON] Found ${shopsToSync?.length || 0} shops to sync`);

    const results = [];
    
    for (const shop of shopsToSync || []) {
      try {
        // Tạo sync job
        const { data: job, error: jobError } = await supabase
          .from('sync_jobs')
          .insert({
            shop_id: shop.shop_id,
            user_id: shop.user_id,
            job_type: 'shop_performance',
            status: 'pending',
            next_run_at: new Date().toISOString()
          })
          .select()
          .single();

        if (jobError) {
          console.error(`Failed to create job for shop ${shop.shop_id}:`, jobError);
          continue;
        }

        // Trigger sync worker
        const { data: syncResult, error: syncError } = await supabase.functions.invoke('shopee-sync-worker', {
          body: {
            action: 'sync-shop-performance',
            shop_id: shop.shop_id,
            user_id: shop.user_id,
            job_id: job.id
          }
        });

        if (syncError) {
          console.error(`Sync failed for shop ${shop.shop_id}:`, syncError);
          results.push({ shop_id: shop.shop_id, status: 'failed', error: syncError.message });
        } else {
          console.log(`Sync completed for shop ${shop.shop_id}`);
          results.push({ shop_id: shop.shop_id, status: 'completed', metrics: syncResult.metrics_count });
        }

        // Delay giữa các requests để tránh rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (shopError) {
        console.error(`Error processing shop ${shop.shop_id}:`, shopError);
        results.push({ shop_id: shop.shop_id, status: 'error', error: (shopError as Error).message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});