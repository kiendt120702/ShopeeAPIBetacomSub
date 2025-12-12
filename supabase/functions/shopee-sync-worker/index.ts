/**
 * Supabase Edge Function: Shopee Sync Worker
 * Background worker để đồng bộ dữ liệu từ Shopee về Supabase
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SHOPEE_PARTNER_ID = Number(Deno.env.get('SHOPEE_PARTNER_ID'));
const SHOPEE_PARTNER_KEY = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
const SHOPEE_BASE_URL = Deno.env.get('SHOPEE_BASE_URL') || 'https://partner.shopeemobile.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function createSignature(
  partnerId: number,
  path: string,
  timestamp: number,
  accessToken = '',
  shopId = 0
): Promise<string> {
  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(SHOPEE_PARTNER_KEY);
  const messageData = encoder.encode(baseString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getTokenWithAutoRefresh(supabase: any, shopId: number, userId?: string) {
  console.log(`[SYNC] Looking for token - shop_id: ${shopId}, user_id: ${userId}`);
  
  // Try to get token from user_shops table first (with user_id if provided)
  let query = supabase.from('user_shops').select('*').eq('shop_id', shopId);
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data: shopData, error: shopError } = await query.single();

  console.log(`[SYNC] user_shops query result:`, { 
    found: !!shopData, 
    error: shopError?.message,
    hasAccessToken: !!shopData?.access_token 
  });

  if (shopError || !shopData) {
    // Fallback to shopee_tokens table
    const { data: tokenData, error: tokenError } = await supabase
      .from('shopee_tokens')
      .select('*')
      .eq('shop_id', shopId)
      .single();

    console.log(`[SYNC] shopee_tokens query result:`, { 
      found: !!tokenData, 
      error: tokenError?.message 
    });

    if (tokenError || !tokenData) {
      // For testing: Use environment variables if available
      const testAccessToken = Deno.env.get('TEST_SHOPEE_ACCESS_TOKEN');
      const testRefreshToken = Deno.env.get('TEST_SHOPEE_REFRESH_TOKEN');
      
      if (testAccessToken && testRefreshToken) {
        console.log(`[SYNC] Using test tokens for shop ${shopId}`);
        return {
          access_token: testAccessToken,
          refresh_token: testRefreshToken,
          shop_id: shopId,
        };
      }
      
      throw new Error(`Token not found for shop ${shopId}. Please authenticate first. Check: 1) User logged into Supabase 2) Shopee token saved to database 3) RLS policies allow access`);
    }

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      shop_id: tokenData.shop_id,
    };
  }

  return {
    access_token: shopData.access_token,
    refresh_token: shopData.refresh_token,
    shop_id: shopData.shop_id,
  };
}

async function callShopeeAPI(
  supabase: any,
  path: string,
  shopId: number,
  token: any
): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = await createSignature(SHOPEE_PARTNER_ID, path, timestamp, token.access_token, shopId);

  const params = new URLSearchParams({
    partner_id: SHOPEE_PARTNER_ID.toString(),
    timestamp: timestamp.toString(),
    access_token: token.access_token,
    shop_id: shopId.toString(),
    sign: sign,
  });

  const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
  console.log('Calling Shopee API:', path);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return await response.json();
}

async function syncShopPerformance(supabase: any, shopId: number, userId: string) {
  console.log(`[SYNC] Starting shop performance sync for shop ${shopId}, user ${userId}`);
  
  try {
    // Get token with userId for better lookup
    const token = await getTokenWithAutoRefresh(supabase, shopId, userId);
    
    // Call Shopee API
    const apiResponse = await callShopeeAPI(
      supabase,
      '/api/v2/account_health/get_shop_performance',
      shopId,
      token
    );

    if (apiResponse.error) {
      throw new Error(`Shopee API error: ${apiResponse.message}`);
    }

    const { overall_performance, metric_list } = apiResponse.response;

    // Save performance data (upsert by shop_id + user_id)
    const { error: performanceError } = await supabase
      .from('shop_performance_data')
      .upsert({
        shop_id: shopId,
        user_id: userId,
        rating: overall_performance.rating,
        fulfillment_failed: overall_performance.fulfillment_failed,
        listing_failed: overall_performance.listing_failed,
        custom_service_failed: overall_performance.custom_service_failed,
        raw_response: apiResponse.response,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'shop_id,user_id',
      });

    if (performanceError) {
      console.error('Failed to save performance data:', performanceError);
    }

    // Save individual metrics (upsert by shop_id + metric_id + user_id)
    for (const metric of metric_list) {
      const isPassingTarget = calculateMetricStatus(metric);
      
      const { error: metricError } = await supabase
        .from('shop_metrics_data')
        .upsert({
          shop_id: shopId,
          user_id: userId,
          metric_id: metric.metric_id,
          metric_name: metric.metric_name,
          metric_type: metric.metric_type,
          parent_metric_id: metric.parent_metric_id,
          current_period: metric.current_period,
          last_period: metric.last_period,
          unit: metric.unit,
          target_value: metric.target.value,
          target_comparator: metric.target.comparator,
          is_passing: isPassingTarget,
          exemption_end_date: metric.exemption_end_date || null,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'shop_id,metric_id,user_id',
        });

      if (metricError) {
        console.error(`Failed to save metric ${metric.metric_id}:`, metricError);
      }
    }

    // Update sync_status
    await updateSyncStatus(supabase, shopId, userId, 'shop_performance_synced_at');

    console.log(`[SYNC] Completed shop performance sync for shop ${shopId}`);
    return { success: true, metrics_count: metric_list.length };

  } catch (error) {
    console.error(`[SYNC] Failed shop performance sync for shop ${shopId}:`, error);
    throw error;
  }
}

async function syncFlashSaleData(supabase: any, shopId: number, userId: string) {
  console.log(`[SYNC] Starting flash sale sync for shop ${shopId}, user ${userId}`);
  
  try {
    // Get token with userId for better lookup
    const token = await getTokenWithAutoRefresh(supabase, shopId, userId);
    
    // Call Shopee API for flash sale list
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/flash_sale/get_flash_sale_list';
    const sign = await createSignature(SHOPEE_PARTNER_ID, path, timestamp, token.access_token, shopId);

    const params = new URLSearchParams({
      partner_id: SHOPEE_PARTNER_ID.toString(),
      timestamp: timestamp.toString(),
      access_token: token.access_token,
      shop_id: shopId.toString(),
      sign: sign,
      type: '0',
      offset: '0',
      limit: '100',
    });

    const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
    console.log('Calling Flash Sale API:', path);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const apiResponse = await response.json();

    if (apiResponse.error && apiResponse.error !== '-') {
      throw new Error(`Shopee API error: ${apiResponse.message}`);
    }

    const flashSaleList = apiResponse.response?.flash_sale_list || [];

    // Clear old data for this shop
    await supabase
      .from('flash_sale_data')
      .delete()
      .eq('shop_id', shopId)
      .eq('user_id', userId);

    // Save new flash sale data
    for (const flashSale of flashSaleList) {
      const { error: flashSaleError } = await supabase
        .from('flash_sale_data')
        .insert({
          shop_id: shopId,
          user_id: userId,
          flash_sale_id: flashSale.flash_sale_id,
          timeslot_id: flashSale.timeslot_id,
          status: flashSale.status,
          start_time: flashSale.start_time,
          end_time: flashSale.end_time,
          enabled_item_count: flashSale.enabled_item_count,
          item_count: flashSale.item_count,
          type: flashSale.type,
          remindme_count: flashSale.remindme_count,
          click_count: flashSale.click_count,
          raw_response: flashSale,
          synced_at: new Date().toISOString(),
        });

      if (flashSaleError) {
        console.error(`Failed to save flash sale ${flashSale.flash_sale_id}:`, flashSaleError);
      }
    }

    // Update sync_status
    await updateSyncStatus(supabase, shopId, userId, 'flash_sales_synced_at');

    console.log(`[SYNC] Completed flash sale sync for shop ${shopId}, saved ${flashSaleList.length} items`);
    return { success: true, flash_sale_count: flashSaleList.length };

  } catch (error) {
    console.error(`[SYNC] Failed flash sale sync for shop ${shopId}:`, error);
    throw error;
  }
}

async function syncAdsCampaignData(supabase: any, shopId: number, userId: string) {
  console.log(`[SYNC] Starting ads campaign sync for shop ${shopId}, user ${userId}`);
  
  try {
    // Get token with userId for better lookup
    const token = await getTokenWithAutoRefresh(supabase, shopId, userId);
    
    // Call Shopee API for campaign list
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/ads/get_campaign_id_list';
    const sign = await createSignature(SHOPEE_PARTNER_ID, path, timestamp, token.access_token, shopId);

    const params = new URLSearchParams({
      partner_id: SHOPEE_PARTNER_ID.toString(),
      timestamp: timestamp.toString(),
      access_token: token.access_token,
      shop_id: shopId.toString(),
      sign: sign,
      ad_type: 'all',
    });

    const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
    console.log('Calling Ads Campaign API:', path);

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const apiResponse = await response.json();

    if (apiResponse.error && apiResponse.error !== '-') {
      throw new Error(`Shopee API error: ${apiResponse.message}`);
    }

    const campaignList = apiResponse.response?.campaign_list || [];

    // Clear old data for this shop
    await supabase
      .from('ads_campaign_data')
      .delete()
      .eq('shop_id', shopId)
      .eq('user_id', userId);

    // Get detailed info for campaigns in batches
    const batchSize = 100;
    let totalSaved = 0;

    for (let i = 0; i < campaignList.length; i += batchSize) {
      const batch = campaignList.slice(i, i + batchSize);
      const campaignIds = batch.map((c: any) => c.campaign_id);

      try {
        // Get campaign details
        const detailTimestamp = Math.floor(Date.now() / 1000);
        const detailPath = '/api/v2/ads/get_campaign_setting_info';
        const detailSign = await createSignature(SHOPEE_PARTNER_ID, detailPath, detailTimestamp, token.access_token, shopId);

        const detailParams = new URLSearchParams({
          partner_id: SHOPEE_PARTNER_ID.toString(),
          timestamp: detailTimestamp.toString(),
          access_token: token.access_token,
          shop_id: shopId.toString(),
          sign: detailSign,
          campaign_id_list: campaignIds.join(','),
          info_type_list: '1,3', // common_info and auto_bidding_info
        });

        const detailUrl = `${SHOPEE_BASE_URL}${detailPath}?${detailParams.toString()}`;
        console.log('Calling Campaign Detail API:', detailPath);

        const detailResponseRaw = await fetch(detailUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const detailResponse = { response: await detailResponseRaw.json() };

        if (detailResponse.response?.campaign_list) {
          for (const campaign of detailResponse.response.campaign_list) {
            const { error: campaignError } = await supabase
              .from('ads_campaign_data')
              .insert({
                shop_id: shopId,
                user_id: userId,
                campaign_id: campaign.campaign_id,
                ad_type: campaign.common_info?.ad_type || 'auto',
                name: campaign.common_info?.ad_name || '',
                status: campaign.common_info?.campaign_status || 'unknown',
                campaign_placement: campaign.common_info?.campaign_placement || '',
                bidding_method: campaign.common_info?.bidding_method || '',
                campaign_budget: campaign.common_info?.campaign_budget || 0,
                start_time: campaign.common_info?.campaign_duration?.start_time || 0,
                end_time: campaign.common_info?.campaign_duration?.end_time || 0,
                item_count: campaign.common_info?.item_id_list?.length || 0,
                roas_target: campaign.auto_bidding_info?.roas_target || null,
                raw_response: campaign,
                synced_at: new Date().toISOString(),
              });

            if (campaignError) {
              console.error(`Failed to save campaign ${campaign.campaign_id}:`, campaignError);
            } else {
              totalSaved++;
            }
          }
        }
      } catch (batchError) {
        console.error('Error processing campaign batch:', batchError);
      }
    }

    // Update sync_status
    await updateSyncStatus(supabase, shopId, userId, 'campaigns_synced_at');

    console.log(`[SYNC] Completed ads campaign sync for shop ${shopId}, saved ${totalSaved} campaigns`);
    return { success: true, campaign_count: totalSaved };

  } catch (error) {
    console.error(`[SYNC] Failed ads campaign sync for shop ${shopId}:`, error);
    throw error;
  }
}

function calculateMetricStatus(metric: any): boolean {
  if (metric.current_period === null) return false;
  
  const { value, comparator } = metric.target;
  const current = metric.current_period;
  
  switch (comparator) {
    case '<': return current < value;
    case '<=': return current <= value;
    case '>': return current > value;
    case '>=': return current >= value;
    case '=': return current === value;
    default: return false;
  }
}

// Helper function to update sync_status table
async function updateSyncStatus(supabase: any, shopId: number, userId: string, field: string) {
  const now = new Date().toISOString();
  
  // Upsert sync_status
  const { error } = await supabase
    .from('sync_status')
    .upsert({
      shop_id: shopId,
      user_id: userId,
      [field]: now,
      is_syncing: false,
      last_sync_error: null,
      updated_at: now,
    }, {
      onConflict: 'shop_id,user_id',
    });

  if (error) {
    console.error(`Failed to update sync_status for ${field}:`, error);
  }
}

async function updateSyncJob(supabase: any, jobId: string, updates: any) {
  const { error } = await supabase
    .from('sync_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to update sync job:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, shop_id, user_id, job_id } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    switch (action) {
      case 'sync-shop-performance': {
        if (!shop_id || !user_id) {
          return new Response(JSON.stringify({ error: 'shop_id and user_id are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update job status to running
        if (job_id) {
          await updateSyncJob(supabase, job_id, {
            status: 'running',
            started_at: new Date().toISOString()
          });
        }

        try {
          const result = await syncShopPerformance(supabase, shop_id, user_id);
          
          // Update job status to completed
          if (job_id) {
            await updateSyncJob(supabase, job_id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              processed_items: result.metrics_count,
              total_items: result.metrics_count
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (syncError) {
          // Update job status to failed
          if (job_id) {
            await updateSyncJob(supabase, job_id, {
              status: 'failed',
              error_message: (syncError as Error).message,
              completed_at: new Date().toISOString()
            });
          }
          throw syncError;
        }
      }

      case 'sync-flash-sale-data': {
        if (!shop_id || !user_id) {
          return new Response(JSON.stringify({ error: 'shop_id and user_id are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update job status to running
        if (job_id) {
          await updateSyncJob(supabase, job_id, {
            status: 'running',
            started_at: new Date().toISOString()
          });
        }

        try {
          const result = await syncFlashSaleData(supabase, shop_id, user_id);
          
          // Update job status to completed
          if (job_id) {
            await updateSyncJob(supabase, job_id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              processed_items: result.flash_sale_count,
              total_items: result.flash_sale_count
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (syncError) {
          // Update job status to failed
          if (job_id) {
            await updateSyncJob(supabase, job_id, {
              status: 'failed',
              error_message: (syncError as Error).message,
              completed_at: new Date().toISOString()
            });
          }
          throw syncError;
        }
      }

      case 'sync-ads-campaign-data': {
        if (!shop_id || !user_id) {
          return new Response(JSON.stringify({ error: 'shop_id and user_id are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update job status to running
        if (job_id) {
          await updateSyncJob(supabase, job_id, {
            status: 'running',
            started_at: new Date().toISOString()
          });
        }

        try {
          const result = await syncAdsCampaignData(supabase, shop_id, user_id);
          
          // Update job status to completed
          if (job_id) {
            await updateSyncJob(supabase, job_id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              processed_items: result.campaign_count,
              total_items: result.campaign_count
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } catch (syncError) {
          // Update job status to failed
          if (job_id) {
            await updateSyncJob(supabase, job_id, {
              status: 'failed',
              error_message: (syncError as Error).message,
              completed_at: new Date().toISOString()
            });
          }
          throw syncError;
        }
      }

      case 'schedule-sync': {
        if (!shop_id || !user_id) {
          return new Response(JSON.stringify({ error: 'shop_id and user_id are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { job_type = 'shop_performance' } = body;

        // Create sync job
        const { data: job, error: jobError } = await supabase
          .from('sync_jobs')
          .insert({
            shop_id,
            user_id,
            job_type,
            status: 'pending',
            next_run_at: new Date().toISOString()
          })
          .select()
          .single();

        if (jobError) {
          throw jobError;
        }

        return new Response(JSON.stringify({ job_id: job.id, status: 'scheduled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Sync worker error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});