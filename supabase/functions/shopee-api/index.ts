/**
 * Supabase Edge Function: Shopee API
 * Unified API endpoint để đọc dữ liệu từ database
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Helper function to create supabase client with proper auth
function createSupabaseClient(req?: Request) {
  // Always use service role for edge functions to bypass RLS
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, shop_id, user_id, days = 30 } = body;

    console.log('API Request:', { action, shop_id, user_id });

    if (!shop_id) {
      return new Response(JSON.stringify({ error: 'shop_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabaseClient(req);

    let result;

    switch (action) {
      case 'get-shop-performance': {
        // Lấy dữ liệu performance mới nhất từ database
        const { data: performanceData, error: perfError } = await supabase
          .from('shop_performance_data')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('user_id', user_id)
          .order('synced_at', { ascending: false })
          .limit(1)
          .single();

        if (perfError && perfError.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Performance data error:', perfError);
          throw perfError;
        }

        console.log('Performance data result:', { found: !!performanceData });

        if (!performanceData) {
          result = { 
            error: 'no_data',
            message: 'Chưa có dữ liệu. Vui lòng đồng bộ từ Shopee.',
            needs_sync: true
          };
        } else {
          // Lấy metrics data
          const { data: metricsData, error: metricsError } = await supabase
            .from('shop_metrics_data')
            .select('*')
            .eq('shop_id', shop_id)
            .eq('user_id', user_id)
            .order('synced_at', { ascending: false });

          if (metricsError) {
            console.warn('Failed to load metrics:', metricsError);
          }

          // Transform database data to API format
          result = {
            overall_performance: {
              rating: performanceData.rating,
              fulfillment_failed: performanceData.fulfillment_failed,
              listing_failed: performanceData.listing_failed,
              custom_service_failed: performanceData.custom_service_failed,
            },
            metric_list: (metricsData || []).map(metric => ({
              metric_id: metric.metric_id,
              metric_name: metric.metric_name,
              metric_type: metric.metric_type,
              parent_metric_id: metric.parent_metric_id,
              current_period: metric.current_period,
              last_period: metric.last_period,
              unit: metric.unit,
              target: {
                value: metric.target_value,
                comparator: metric.target_comparator,
              },
              exemption_end_date: metric.exemption_end_date,
            })),
            synced_at: performanceData.synced_at
          };
        }
        break;
      }

      case 'get-performance-history': {
        // Lấy lịch sử performance
        const { data, error } = await supabase
          .rpc('get_shop_performance_history', {
            p_shop_id: shop_id,
            p_user_id: user_id,
            p_days: days
          });

        if (error) throw error;
        result = { history: data || [] };
        break;
      }

      case 'get-metric-trends': {
        const { metric_ids } = body;
        
        // Lấy xu hướng metrics
        const { data, error } = await supabase
          .rpc('get_metric_trends', {
            p_shop_id: shop_id,
            p_user_id: user_id,
            p_metric_ids: metric_ids || null,
            p_days: days
          });

        if (error) throw error;
        result = { trends: data || [] };
        break;
      }

      case 'get-flash-sale-data': {
        // Lấy dữ liệu Flash Sale từ database
        const { data: flashSaleData, error: flashSaleError } = await supabase
          .from('flash_sale_data')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('user_id', user_id)
          .order('synced_at', { ascending: false });

        if (flashSaleError && flashSaleError.code !== 'PGRST116') {
          console.error('Flash Sale data error:', flashSaleError);
          throw flashSaleError;
        }

        if (!flashSaleData || flashSaleData.length === 0) {
          result = { 
            error: 'no_data',
            message: 'Chưa có dữ liệu Flash Sale. Vui lòng đồng bộ từ Shopee.',
            needs_sync: true
          };
        } else {
          // Transform database data to API format
          result = {
            flash_sale_list: flashSaleData.map(fs => ({
              flash_sale_id: fs.flash_sale_id,
              timeslot_id: fs.timeslot_id,
              status: fs.status,
              start_time: fs.start_time,
              end_time: fs.end_time,
              enabled_item_count: fs.enabled_item_count,
              item_count: fs.item_count,
              type: fs.type,
              remindme_count: fs.remindme_count,
              click_count: fs.click_count,
            })),
            total_count: flashSaleData.length,
            synced_at: flashSaleData[0]?.synced_at
          };
        }
        break;
      }

      case 'get-ads-campaign-data': {
        // Lấy dữ liệu Ads Campaign từ database
        const { data: campaignData, error: campaignError } = await supabase
          .from('ads_campaign_data')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('user_id', user_id)
          .order('synced_at', { ascending: false });

        if (campaignError && campaignError.code !== 'PGRST116') {
          console.error('Campaign data error:', campaignError);
          throw campaignError;
        }

        if (!campaignData || campaignData.length === 0) {
          result = { 
            error: 'no_data',
            message: 'Chưa có dữ liệu Ads Campaign. Vui lòng đồng bộ từ Shopee.',
            needs_sync: true
          };
        } else {
          // Transform database data to API format
          result = {
            campaign_list: campaignData.map(camp => ({
              campaign_id: camp.campaign_id,
              ad_type: camp.ad_type,
              name: camp.name,
              status: camp.status,
              common_info: {
                ad_type: camp.ad_type,
                ad_name: camp.name || '',
                campaign_status: camp.status,
                campaign_placement: camp.campaign_placement,
                bidding_method: camp.bidding_method,
                campaign_budget: camp.campaign_budget,
                campaign_duration: {
                  start_time: camp.start_time || 0,
                  end_time: camp.end_time || 0,
                },
                item_id_list: Array(camp.item_count).fill(0), // Placeholder
              },
              roas_target: camp.roas_target,
            })),
            total_count: campaignData.length,
            synced_at: campaignData[0]?.synced_at
          };
        }
        break;
      }

      case 'get-sync-status': {
        // Kiểm tra trạng thái sync jobs
        const { job_type = 'shop_performance' } = body;
        const { data, error } = await supabase
          .from('sync_jobs')
          .select('*')
          .eq('shop_id', shop_id)
          .eq('user_id', user_id)
          .eq('job_type', job_type)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        result = { sync_jobs: data || [] };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});