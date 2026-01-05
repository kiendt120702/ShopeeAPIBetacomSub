/**
 * Shopee Order API Client via Supabase Edge Functions
 * Gọi backend API để quản lý đơn hàng
 */

import { supabase } from '../supabase';
import type {
  GetOrderListParams,
  GetOrderListResponse,
  GetOrderDetailParams,
  GetOrderDetailResponse,
  OrderStatus,
  TimeRangeField,
} from './types';

/**
 * Lấy danh sách đơn hàng
 * GET /api/v2/order/get_order_list
 * 
 * @param shopId - Shop ID
 * @param params - Tham số query
 * @returns Danh sách đơn hàng
 * 
 * @example
 * // Lấy đơn hàng trong 7 ngày gần nhất
 * const now = Math.floor(Date.now() / 1000);
 * const sevenDaysAgo = now - 7 * 24 * 60 * 60;
 * 
 * const result = await getOrderList(shopId, {
 *   time_range_field: 'create_time',
 *   time_from: sevenDaysAgo,
 *   time_to: now,
 *   page_size: 50,
 *   order_status: 'READY_TO_SHIP',
 * });
 */
export async function getOrderList(
  shopId: number,
  params: GetOrderListParams
): Promise<GetOrderListResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-order', {
    body: {
      action: 'get-order-list',
      shop_id: shopId,
      ...params,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get order list');
  }

  return data as GetOrderListResponse;
}

/**
 * Lấy tất cả đơn hàng (auto pagination)
 * Tự động gọi nhiều lần nếu có nhiều trang
 * 
 * @param shopId - Shop ID
 * @param params - Tham số query (không cần cursor)
 * @returns Tất cả đơn hàng
 */
export async function getAllOrders(
  shopId: number,
  params: Omit<GetOrderListParams, 'cursor'>
): Promise<GetOrderListResponse['response']> {
  const allOrders: GetOrderListResponse['response'] = {
    more: false,
    order_list: [],
    next_cursor: '',
  };

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await getOrderList(shopId, {
      ...params,
      cursor,
    });

    if (result.error) {
      throw new Error(result.message || result.error);
    }

    if (result.response) {
      allOrders.order_list.push(...result.response.order_list);
      hasMore = result.response.more;
      cursor = result.response.next_cursor;
    } else {
      hasMore = false;
    }
  }

  return allOrders;
}

/**
 * Lấy chi tiết đơn hàng
 * GET /api/v2/order/get_order_detail
 * 
 * @param shopId - Shop ID
 * @param orderSnList - Danh sách order_sn (tối đa 50)
 * @param responseOptionalFields - Các field tùy chọn muốn lấy thêm
 * @returns Chi tiết đơn hàng
 * 
 * @example
 * const result = await getOrderDetail(shopId, ['2401234567890ABC']);
 */
export async function getOrderDetail(
  shopId: number,
  orderSnList: string[],
  responseOptionalFields?: string
): Promise<GetOrderDetailResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-order', {
    body: {
      action: 'get-order-detail',
      shop_id: shopId,
      order_sn_list: orderSnList,
      response_optional_fields: responseOptionalFields,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get order detail');
  }

  return data as GetOrderDetailResponse;
}

/**
 * Lấy chi tiết nhiều đơn hàng (auto batch)
 * Tự động chia thành nhiều request nếu > 50 orders
 * 
 * @param shopId - Shop ID
 * @param orderSnList - Danh sách order_sn (không giới hạn)
 * @param responseOptionalFields - Các field tùy chọn
 * @returns Chi tiết tất cả đơn hàng
 */
export async function getOrderDetailBatch(
  shopId: number,
  orderSnList: string[],
  responseOptionalFields?: string
): Promise<GetOrderDetailResponse['response']> {
  const BATCH_SIZE = 50;
  const allOrders: GetOrderDetailResponse['response'] = {
    order_list: [],
  };

  // Chia thành các batch 50 orders
  for (let i = 0; i < orderSnList.length; i += BATCH_SIZE) {
    const batch = orderSnList.slice(i, i + BATCH_SIZE);
    const result = await getOrderDetail(shopId, batch, responseOptionalFields);

    if (result.error) {
      throw new Error(result.message || result.error);
    }

    if (result.response) {
      allOrders.order_list.push(...result.response.order_list);
    }
  }

  return allOrders;
}

// Re-export types for convenience
export type { OrderStatus, TimeRangeField, GetOrderListParams, GetOrderDetailParams };

/**
 * Lấy chi tiết tài chính đơn hàng (escrow)
 * GET /api/v2/payment/get_escrow_detail
 * 
 * @param shopId - Shop ID
 * @param orderSn - Mã đơn hàng
 * @returns Chi tiết tài chính (phí, hoa hồng, tiền nhận...)
 */
export async function getEscrowDetail(
  shopId: number,
  orderSn: string
): Promise<import('./types').GetEscrowDetailResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-order', {
    body: {
      action: 'get-escrow-detail',
      shop_id: shopId,
      order_sn: orderSn,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get escrow detail');
  }

  return data;
}


/**
 * Lấy danh sách escrow (đơn hàng đã giải ngân)
 * GET /api/v2/payment/get_escrow_list
 * 
 * @param shopId - Shop ID
 * @param releaseTimeFrom - Thời gian bắt đầu (Unix timestamp)
 * @param releaseTimeTo - Thời gian kết thúc (Unix timestamp)
 * @param pageSize - Số đơn/trang (max 100, default 40)
 * @param pageNo - Số trang (default 1)
 * @returns Danh sách escrow
 */
export async function getEscrowList(
  shopId: number,
  releaseTimeFrom: number,
  releaseTimeTo: number,
  pageSize = 40,
  pageNo = 1
): Promise<import('./types').GetEscrowListResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-order', {
    body: {
      action: 'get-escrow-list',
      shop_id: shopId,
      release_time_from: releaseTimeFrom,
      release_time_to: releaseTimeTo,
      page_size: pageSize,
      page_no: pageNo,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get escrow list');
  }

  return data;
}


/**
 * Lấy thông tin tracking chi tiết (lịch sử đơn hàng)
 * GET /api/v2/logistics/get_tracking_info
 * 
 * @param shopId - Shop ID
 * @param orderSn - Mã đơn hàng
 * @param packageNumber - Mã package (optional)
 * @returns Lịch sử tracking với timeline
 */
export async function getTrackingInfo(
  shopId: number,
  orderSn: string,
  packageNumber?: string
): Promise<import('./types').GetTrackingInfoResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-order', {
    body: {
      action: 'get-tracking-info',
      shop_id: shopId,
      order_sn: orderSn,
      package_number: packageNumber,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get tracking info');
  }

  return data;
}
