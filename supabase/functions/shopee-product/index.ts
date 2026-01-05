/**
 * Supabase Edge Function: Shopee Product
 * Quản lý Product API với Auto-Refresh Token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_PARTNER_ID = Number(Deno.env.get('SHOPEE_PARTNER_ID'));
const DEFAULT_PARTNER_KEY = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
const SHOPEE_BASE_URL = Deno.env.get('SHOPEE_BASE_URL') || 'https://partner.shopeemobile.com';
const PROXY_URL = Deno.env.get('SHOPEE_PROXY_URL') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface PartnerCredentials {
  partnerId: number;
  partnerKey: string;
}

async function getPartnerCredentials(
  supabase: ReturnType<typeof createClient>,
  shopId: number
): Promise<PartnerCredentials> {
  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('partner_id, partner_key')
    .eq('shop_id', shopId)
    .single();

  if (data?.partner_id && data?.partner_key && !error) {
    return { partnerId: data.partner_id, partnerKey: data.partner_key };
  }
  return { partnerId: DEFAULT_PARTNER_ID, partnerKey: DEFAULT_PARTNER_KEY };
}

async function fetchWithProxy(targetUrl: string, options: RequestInit): Promise<Response> {
  if (PROXY_URL) {
    const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
    return await fetch(proxyUrl, options);
  }
  return await fetch(targetUrl, options);
}

function createSignature(
  partnerKey: string,
  partnerId: number,
  path: string,
  timestamp: number,
  accessToken = '',
  shopId = 0
): string {
  let baseString = `${partnerId}${path}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += shopId;
  const hmac = createHmac('sha256', partnerKey);
  hmac.update(baseString);
  return hmac.digest('hex');
}


async function refreshAccessToken(
  credentials: PartnerCredentials,
  refreshToken: string,
  shopId: number
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v2/auth/access_token/get';
  const sign = createSignature(credentials.partnerKey, credentials.partnerId, path, timestamp);
  const url = `${SHOPEE_BASE_URL}${path}?partner_id=${credentials.partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: refreshToken,
      partner_id: credentials.partnerId,
      shop_id: shopId,
    }),
  });
  return await response.json();
}

async function saveToken(
  supabase: ReturnType<typeof createClient>,
  shopId: number,
  token: Record<string, unknown>
) {
  await supabase.from('apishopee_shops').upsert({
    shop_id: shopId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expire_in: token.expire_in,
    expired_at: Date.now() + (token.expire_in as number) * 1000,
    token_updated_at: new Date().toISOString(),
  }, { onConflict: 'shop_id' });
}

async function getTokenWithAutoRefresh(
  supabase: ReturnType<typeof createClient>,
  shopId: number
) {
  const { data, error } = await supabase
    .from('apishopee_shops')
    .select('shop_id, access_token, refresh_token, expired_at')
    .eq('shop_id', shopId)
    .single();

  if (error || !data?.access_token) {
    throw new Error('Token not found. Please authenticate first.');
  }
  return data;
}


async function callShopeeAPIWithRetry(
  supabase: ReturnType<typeof createClient>,
  credentials: PartnerCredentials,
  path: string,
  method: 'GET' | 'POST',
  shopId: number,
  token: { access_token: string; refresh_token: string },
  body?: Record<string, unknown>,
  extraParams?: Record<string, string | number | boolean | string[]>
): Promise<unknown> {
  const makeRequest = async (accessToken: string) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = createSignature(credentials.partnerKey, credentials.partnerId, path, timestamp, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: credentials.partnerId.toString(),
      timestamp: timestamp.toString(),
      access_token: accessToken,
      shop_id: shopId.toString(),
      sign: sign,
    });

    // Xử lý extraParams - hỗ trợ array cho item_status
    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            // Shopee yêu cầu multiple params cho array: item_status=NORMAL&item_status=BANNED
            value.forEach(v => params.append(key, v.toString()));
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
    console.log('Calling Shopee API:', path);

    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetchWithProxy(url, options);
    return await response.json();
  };

  let result = await makeRequest(token.access_token);

  // Auto refresh token nếu hết hạn
  if (result.error === 'error_auth' || result.message?.includes('Invalid access_token')) {
    console.log('[AUTO-RETRY] Invalid token, refreshing...');
    const newToken = await refreshAccessToken(credentials, token.refresh_token, shopId);
    if (!newToken.error) {
      await saveToken(supabase, shopId, newToken);
      result = await makeRequest(newToken.access_token);
    }
  }

  return result;
}


// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, shop_id } = body;

    if (!shop_id) {
      return new Response(JSON.stringify({ error: 'shop_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const credentials = await getPartnerCredentials(supabase, shop_id);
    const token = await getTokenWithAutoRefresh(supabase, shop_id);

    let result;

    switch (action) {
      case 'get-item-list': {
        const { offset = 0, page_size = 20, item_status, update_time_from, update_time_to } = body;
        
        const extraParams: Record<string, string | number | string[]> = {
          offset,
          page_size: Math.min(page_size, 100), // Max 100
        };

        // item_status là required, mặc định lấy NORMAL
        if (item_status && Array.isArray(item_status)) {
          extraParams.item_status = item_status;
        } else if (item_status) {
          extraParams.item_status = [item_status];
        } else {
          extraParams.item_status = ['NORMAL'];
        }

        if (update_time_from) extraParams.update_time_from = update_time_from;
        if (update_time_to) extraParams.update_time_to = update_time_to;

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/product/get_item_list',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
        break;
      }

      case 'get-item-base-info': {
        const { item_id_list, need_tax_info = false, need_complaint_policy = false } = body;
        
        if (!item_id_list || !Array.isArray(item_id_list) || item_id_list.length === 0) {
          return new Response(JSON.stringify({ error: 'item_id_list is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Max 50 items per request
        const itemIds = item_id_list.slice(0, 50);
        
        const extraParams: Record<string, string | number | boolean> = {
          item_id_list: itemIds.join(','),
        };
        if (need_tax_info) extraParams.need_tax_info = need_tax_info;
        if (need_complaint_policy) extraParams.need_complaint_policy = need_complaint_policy;

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/product/get_item_base_info',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
        break;
      }

      case 'get-item-extra-info': {
        const { item_id_list } = body;
        
        if (!item_id_list || !Array.isArray(item_id_list) || item_id_list.length === 0) {
          return new Response(JSON.stringify({ error: 'item_id_list is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Max 50 items per request
        const itemIds = item_id_list.slice(0, 50);
        
        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/product/get_item_extra_info',
          'GET',
          shop_id,
          token,
          undefined,
          { item_id_list: itemIds.join(',') }
        );
        break;
      }

      // Sync products: gọi API và lưu vào database
      case 'sync-products': {
        const { offset = 0, page_size = 50, item_status = ['NORMAL'] } = body;
        
        // Bước 1: Lấy danh sách item_id
        const listParams: Record<string, string | number | string[]> = {
          offset,
          page_size: Math.min(page_size, 100),
          item_status: Array.isArray(item_status) ? item_status : [item_status],
        };

        const listResult = await callShopeeAPIWithRetry(
          supabase, credentials, '/api/v2/product/get_item_list', 'GET',
          shop_id, token, undefined, listParams
        ) as { response?: { item: Array<{ item_id: number }>; total_count: number; has_next_page: boolean; next_offset: number } };

        if (!listResult.response?.item?.length) {
          result = { ...listResult, synced: 0 };
          break;
        }

        const itemIds = listResult.response.item.map(i => i.item_id);

        // Bước 2: Lấy base info + extra info song song
        const [baseResult, extraResult] = await Promise.all([
          callShopeeAPIWithRetry(
            supabase, credentials, '/api/v2/product/get_item_base_info', 'GET',
            shop_id, token, undefined, { item_id_list: itemIds.join(',') }
          ) as Promise<{ response?: { item_list: Array<Record<string, unknown>> } }>,
          callShopeeAPIWithRetry(
            supabase, credentials, '/api/v2/product/get_item_extra_info', 'GET',
            shop_id, token, undefined, { item_id_list: itemIds.join(',') }
          ) as Promise<{ response?: { item_list: Array<Record<string, unknown>> } }>,
        ]);

        const baseItems = baseResult.response?.item_list || [];
        const extraItems = extraResult.response?.item_list || [];
        const extraMap = new Map(extraItems.map(e => [e.item_id, e]));

        // Bước 3: Merge và lưu vào database
        const productsToUpsert = baseItems.map(item => {
          const extra = extraMap.get(item.item_id) || {};
          const priceInfo = (item.price_info as Array<Record<string, unknown>>)?.[0];
          const stockInfo = item.stock_info_v2 as Record<string, unknown>;
          const summaryInfo = stockInfo?.summary_info as Record<string, unknown>;
          const dimension = item.dimension as Record<string, unknown>;
          const brand = item.brand as Record<string, unknown>;
          const image = item.image as Record<string, unknown>;
          const preOrder = item.pre_order as Record<string, unknown>;
          const videoInfo = item.video_info as Array<unknown>;

          return {
            shop_id,
            item_id: item.item_id,
            item_name: item.item_name,
            item_sku: item.item_sku || null,
            item_status: item.item_status,
            category_id: item.category_id,
            description: item.description || null,
            condition: item.condition || null,
            image_url: (image?.image_url_list as string[])?.[0] || null,
            image_urls: image?.image_url_list || [],
            has_video: videoInfo && videoInfo.length > 0,
            currency: priceInfo?.currency || 'VND',
            original_price: priceInfo?.original_price || null,
            current_price: priceInfo?.current_price || null,
            total_available_stock: summaryInfo?.total_available_stock || 0,
            total_reserved_stock: summaryInfo?.total_reserved_stock || 0,
            weight: item.weight ? parseFloat(item.weight as string) : null,
            package_length: dimension?.package_length || null,
            package_width: dimension?.package_width || null,
            package_height: dimension?.package_height || null,
            has_model: item.has_model || false,
            deboost: item.deboost === true || item.deboost === 'true' || item.deboost === true,
            is_pre_order: preOrder?.is_pre_order || false,
            days_to_ship: preOrder?.days_to_ship || null,
            brand_id: brand?.brand_id || null,
            brand_name: brand?.original_brand_name || null,
            sale: extra.sale || 0,
            views: extra.views || 0,
            likes: extra.likes || 0,
            rating_star: extra.rating_star || null,
            comment_count: extra.comment_count || 0,
            create_time: item.create_time ? new Date((item.create_time as number) * 1000).toISOString() : null,
            update_time: item.update_time ? new Date((item.update_time as number) * 1000).toISOString() : null,
            synced_at: new Date().toISOString(),
          };
        });

        const { error: upsertError } = await supabase
          .from('apishopee_products')
          .upsert(productsToUpsert, { onConflict: 'shop_id,item_id' });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
        }

        result = {
          ...listResult,
          synced: productsToUpsert.length,
          total_count: listResult.response.total_count,
          has_next_page: listResult.response.has_next_page,
          next_offset: listResult.response.next_offset,
        };
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
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
