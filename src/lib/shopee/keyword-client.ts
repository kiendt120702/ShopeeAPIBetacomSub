/**
 * Shopee Keyword API Client via Supabase Edge Functions
 * Tra cứu từ khóa và dung lượng tìm kiếm
 */

import { supabase } from '../supabase';

// Types
export interface SuggestedKeyword {
  keyword: string;
  quality_score: number;
  search_volume: number;
  suggested_bid: number;
}

export interface GetRecommendedKeywordListResponse {
  error?: string;
  message?: string;
  warning?: string;
  request_id?: string;
  response?: {
    item_id: number;
    input_keyword: string | null;
    suggested_keyword_list?: SuggestedKeyword[];
    suggested_keywords?: SuggestedKeyword[]; // backward compatibility
  };
}

export interface GetRecommendedKeywordListParams {
  shop_id: number;
  item_id: number;
  input_keyword?: string;
}

/**
 * Lấy danh sách từ khóa đề xuất cho sản phẩm
 * @param params - Parameters cho API
 * @returns Danh sách từ khóa với search volume và suggested bid
 */
export async function getRecommendedKeywordList(
  params: GetRecommendedKeywordListParams
): Promise<GetRecommendedKeywordListResponse> {
  const { data, error } = await supabase.functions.invoke('shopee-keyword', {
    body: {
      action: 'get-recommended-keyword-list',
      shop_id: params.shop_id,
      item_id: params.item_id,
      input_keyword: params.input_keyword || '',
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get recommended keyword list');
  }

  return data as GetRecommendedKeywordListResponse;
}

// ==================== KEYWORD HISTORY CACHE ====================

export interface KeywordSearchHistory {
  id: string;
  shop_id: number;
  item_id: number;
  item_name?: string;
  input_keyword?: string;
  keywords: SuggestedKeyword[];
  searched_at: string;
}

/**
 * Lưu kết quả tìm kiếm từ khóa vào history
 */
export async function saveKeywordSearchHistory(
  shopId: number,
  itemId: number,
  itemName: string,
  inputKeyword: string,
  keywords: SuggestedKeyword[]
): Promise<void> {
  const { error } = await supabase
    .from('apishopee_keyword_history')
    .insert({
      shop_id: shopId,
      item_id: itemId,
      item_name: itemName,
      input_keyword: inputKeyword,
      keywords: keywords,
      searched_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[saveKeywordSearchHistory] Error:', error);
  }
}

/**
 * Lấy lịch sử tìm kiếm từ khóa
 */
export async function getKeywordSearchHistory(
  shopId: number,
  limit = 20
): Promise<KeywordSearchHistory[]> {
  const { data, error } = await supabase
    .from('apishopee_keyword_history')
    .select('*')
    .eq('shop_id', shopId)
    .order('searched_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getKeywordSearchHistory] Error:', error);
    return [];
  }

  return data || [];
}

/**
 * Xóa một mục lịch sử
 */
export async function deleteKeywordHistory(id: string): Promise<void> {
  const { error } = await supabase
    .from('apishopee_keyword_history')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteKeywordHistory] Error:', error);
  }
}
