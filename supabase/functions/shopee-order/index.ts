/**
 * Supabase Edge Function: Shopee Order
 * Quản lý Order API với Auto-Refresh Token
 * Hỗ trợ: get_order_list, get_order_detail
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shopee API config
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
  await supabase.from('apishopee_shops').upsert(
    {
      shop_id: shopId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expire_in: token.expire_in,
      expired_at: Date.now() + (token.expire_in as number) * 1000,
      token_updated_at: new Date().toISOString(),
    },
    { onConflict: 'shop_id' }
  );
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
  extraParams?: Record<string, string | number | boolean>
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

    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const url = `${SHOPEE_BASE_URL}${path}?${params.toString()}`;
    console.log('[ORDER] Calling Shopee API:', path);

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

  if (result.error === 'error_auth' || result.message?.includes('Invalid access_token')) {
    console.log('[ORDER] Invalid token, refreshing...');

    const newToken = await refreshAccessToken(credentials, token.refresh_token, shopId);

    if (!newToken.error) {
      await saveToken(supabase, shopId, newToken);
      result = await makeRequest(newToken.access_token);
    }
  }

  return result;
}

// ==================== ORDER STATUS ENUM ====================
type OrderStatus = 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'IN_CANCEL' | 'CANCELLED' | 'INVOICE_PENDING';
type TimeRangeField = 'create_time' | 'update_time';

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
      case 'get-order-list': {
        const {
          time_range_field,
          time_from,
          time_to,
          page_size = 20,
          cursor,
          order_status,
          response_optional_fields,
          request_order_status_pending,
        } = body;

        // Validate required params
        if (!time_range_field || !time_from || !time_to) {
          return new Response(
            JSON.stringify({ error: 'time_range_field, time_from, time_to are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const extraParams: Record<string, string | number | boolean> = {
          time_range_field,
          time_from,
          time_to,
          page_size,
        };

        if (cursor) extraParams.cursor = cursor;
        if (order_status) extraParams.order_status = order_status;
        if (response_optional_fields) extraParams.response_optional_fields = response_optional_fields;
        if (request_order_status_pending !== undefined) {
          extraParams.request_order_status_pending = request_order_status_pending;
        }

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/order/get_order_list',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
        break;
      }

      case 'get-order-detail': {
        const { order_sn_list, response_optional_fields } = body;

        if (!order_sn_list || !Array.isArray(order_sn_list) || order_sn_list.length === 0) {
          return new Response(
            JSON.stringify({ error: 'order_sn_list is required and must be a non-empty array' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Shopee API giới hạn tối đa 50 orders mỗi request
        if (order_sn_list.length > 50) {
          return new Response(
            JSON.stringify({ error: 'order_sn_list cannot exceed 50 items' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Default optional fields để lấy đầy đủ thông tin
        const defaultOptionalFields = 'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,invoice_data,checkout_shipping_carrier,reverse_shipping_fee,order_chargeable_weight_gram';

        const extraParams: Record<string, string> = {
          order_sn_list: order_sn_list.join(','),
          response_optional_fields: response_optional_fields || defaultOptionalFields,
        };

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/order/get_order_detail',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
        break;
      }

      case 'get-escrow-detail': {
        const { order_sn } = body;

        if (!order_sn) {
          return new Response(
            JSON.stringify({ error: 'order_sn is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const extraParams: Record<string, string> = {
          order_sn,
        };

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/payment/get_escrow_detail',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
        break;
      }

      case 'get-escrow-list': {
        const { release_time_from, release_time_to, page_size = 40, page_no = 1 } = body;

        if (!release_time_from || !release_time_to) {
          return new Response(
            JSON.stringify({ error: 'release_time_from and release_time_to are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const extraParams: Record<string, string | number> = {
          release_time_from,
          release_time_to,
          page_size,
          page_no,
        };

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/payment/get_escrow_list',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
        break;
      }

      case 'get-tracking-info': {
        const { order_sn, package_number } = body;

        if (!order_sn) {
          return new Response(
            JSON.stringify({ error: 'order_sn is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const extraParams: Record<string, string> = {
          order_sn,
        };

        if (package_number) {
          extraParams.package_number = package_number;
        }

        result = await callShopeeAPIWithRetry(
          supabase,
          credentials,
          '/api/v2/logistics/get_tracking_info',
          'GET',
          shop_id,
          token,
          undefined,
          extraParams
        );
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
    console.error('[ORDER] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
