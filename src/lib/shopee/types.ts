/**
 * Shopee SDK Types
 * Định nghĩa types cho Shopee SDK
 */

export interface AccessToken {
  refresh_token: string;
  access_token: string;
  expire_in: number;
  request_id?: string;
  error?: string;
  message?: string;
  shop_id?: number;
  merchant_id?: number;
  merchant_id_list?: number[];
  shop_id_list?: number[];
  supplier_id_list?: number[];
  expired_at?: number;
}

export interface RefreshedAccessToken extends Omit<AccessToken, 'merchant_id_list' | 'shop_id_list' | 'supplier_id_list'> {
  partner_id: number;
  shop_id?: number;
  merchant_id?: number;
}


// ==================== ADS API TYPES ====================

export type AdType = 'auto' | 'manual' | 'all' | '';
export type CampaignStatus = 'ongoing' | 'scheduled' | 'ended' | 'paused' | 'deleted' | 'closed';
export type BiddingMethod = 'auto' | 'manual';
export type CampaignPlacement = 'search' | 'discovery' | 'all';
export type KeywordStatus = 'deleted' | 'normal' | 'reserved' | 'blacklist';
export type KeywordMatchType = 'exact' | 'broad';
export type DiscoveryLocation = 'daily_discover' | 'you_may_also_like';
export type DiscoveryStatus = 'active' | 'inactive';
export type AutoProductStatus = 'learning' | 'ongoing' | 'paused' | 'ended' | 'unavailable';

// Campaign ID List Response
export interface CampaignIdItem {
  ad_type: AdType;
  campaign_id: number;
}

export interface GetCampaignIdListResponse {
  error: string;
  message: string;
  warning: string;
  request_id: string;
  response?: {
    shop_id: number;
    region: string;
    has_next_page: boolean;
    campaign_list: CampaignIdItem[];
  };
}

// Campaign Setting Info Types
export interface CampaignDuration {
  start_time: number;
  end_time: number;
}

export interface CommonInfo {
  ad_type: AdType;
  ad_name: string;
  campaign_status: CampaignStatus;
  bidding_method: BiddingMethod;
  campaign_placement: CampaignPlacement;
  campaign_budget: number;
  campaign_duration: CampaignDuration;
  item_id_list: number[];
}

export interface SelectedKeyword {
  keyword: string;
  status: KeywordStatus;
  match_type: KeywordMatchType;
  bid_price_per_click: number;
}

export interface DiscoveryAdsLocation {
  location: DiscoveryLocation;
  status: DiscoveryStatus;
  bid_price: number;
}

export interface ManualBiddingInfo {
  enhanced_cpc: boolean;
  selected_keywords: SelectedKeyword[];
  discovery_ads_locations: DiscoveryAdsLocation[];
}

export interface AutoBiddingInfo {
  roas_target: number;
}

export interface AutoProductAdsInfo {
  product_name: string;
  status: AutoProductStatus;
  item_id: number;
}

export interface CampaignSettingInfo {
  campaign_id: number;
  common_info?: CommonInfo;
  manual_bidding_info?: ManualBiddingInfo;
  auto_bidding_info?: AutoBiddingInfo;
  auto_product_ads_info?: AutoProductAdsInfo[];
}

export interface GetCampaignSettingInfoResponse {
  error: string;
  message: string;
  warning: string;
  request_id: string;
  response?: {
    shop_id: number;
    region: string;
    campaign_list: CampaignSettingInfo[];
  };
}

// Info Type Enum for get_product_level_campaign_setting_info
export enum CampaignInfoType {
  CommonInfo = 1,
  ManualBiddingInfo = 2,
  AutoBiddingInfo = 3,
  AutoProductAdsInfo = 4,
}


// ==================== EDIT ADS API TYPES ====================

export type EditAction = 
  | 'start' 
  | 'pause' 
  | 'resume' 
  | 'stop' 
  | 'delete' 
  | 'change_budget' 
  | 'change_duration' 
  | 'change_smart_creative' 
  | 'change_location' 
  | 'change_enhanced_cpc' 
  | 'change_roas_target';

export type SmartCreativeSetting = 'default' | 'on' | 'off' | '';

export interface EditManualProductAdsParams {
  reference_id: string;
  campaign_id: number;
  edit_action: EditAction;
  budget?: number;
  start_date?: string; // DD-MM-YYYY
  end_date?: string;   // DD-MM-YYYY or empty for unlimited
  roas_target?: number;
  discovery_ads_locations?: DiscoveryAdsLocation[];
  enhanced_cpc?: boolean;
  smart_creative_setting?: SmartCreativeSetting;
}

export interface EditAutoProductAdsParams {
  reference_id: string;
  campaign_id: number;
  edit_action: EditAction;
  budget?: number;
  start_date?: string; // DD-MM-YYYY
  end_date?: string;   // DD-MM-YYYY or empty for unlimited
}

export interface EditAdsResponse {
  error: string;
  message: string;
  warning: string;
  request_id: string;
  response?: {
    campaign_id: number;
  }[];
}


// ==================== SHOP API TYPES ====================

// SIP Affiliate Shop Info
export interface SipAffiShop {
  affi_shop_id: number;
  region: string;
}

// Linked Direct Shop Info
export interface LinkedDirectShop {
  direct_shop_id: number;
  direct_shop_region: string;
}

// Outlet Shop Info
export interface OutletShopInfo {
  outlet_shop_id: number;
}

// GET /api/v2/shop/get_shop_info Response
export interface ShopInfo {
  shop_name: string;
  region: string;
  status: 'BANNED' | 'FROZEN' | 'NORMAL';
  sip_affi_shops?: SipAffiShop[];
  is_cb: boolean;
  request_id: string;
  auth_time: number;
  expire_time: number;
  is_sip: boolean;
  is_upgraded_cbsc: boolean;
  merchant_id: number | null;
  shop_fulfillment_flag: string;
  is_main_shop: boolean;
  is_direct_shop: boolean;
  linked_main_shop_id: number;
  linked_direct_shop_list?: LinkedDirectShop[];
  is_one_awb?: boolean;
  is_mart_shop?: boolean;
  is_outlet_shop?: boolean;
  mart_shop_id?: number;
  outlet_shop_info_list?: OutletShopInfo[];
}

export interface GetShopInfoResponse {
  error: string;
  message: string;
  request_id: string;
  auth_time?: number;
  expire_time?: number;
  shop_name?: string;
  region?: string;
  status?: 'BANNED' | 'FROZEN' | 'NORMAL';
  shop_fulfillment_flag?: string;
  is_cb?: boolean;
  is_upgraded_cbsc?: boolean;
  merchant_id?: number | null;
  is_sip?: boolean;
  sip_affi_shops?: SipAffiShop[];
  is_main_shop?: boolean;
  is_direct_shop?: boolean;
  linked_direct_shop_list?: LinkedDirectShop[];
  linked_main_shop_id?: number;
  is_one_awb?: boolean;
  is_mart_shop?: boolean;
  is_outlet_shop?: boolean;
  mart_shop_id?: number;
  outlet_shop_info_list?: OutletShopInfo[];
}

// GET /api/v2/shop/get_profile Response
export interface ShopProfile {
  shop_logo: string;
  description: string;
  shop_name: string;
  invoice_issuer?: string;
}


// ==================== ORDER API TYPES ====================

export type OrderStatus = 
  | 'UNPAID' 
  | 'READY_TO_SHIP' 
  | 'PROCESSED' 
  | 'SHIPPED' 
  | 'COMPLETED' 
  | 'IN_CANCEL' 
  | 'CANCELLED' 
  | 'INVOICE_PENDING';

export type TimeRangeField = 'create_time' | 'update_time';

// GET /api/v2/order/get_order_list Request
export interface GetOrderListParams {
  time_range_field: TimeRangeField;
  time_from: number; // Unix timestamp
  time_to: number;   // Unix timestamp
  page_size?: number; // 1-100, default 20
  cursor?: string;
  order_status?: OrderStatus;
  response_optional_fields?: string; // 'order_status'
  request_order_status_pending?: boolean;
  logistics_channel_id?: number; // Only for BR
}

// Order item trong order_list
export interface OrderListItem {
  order_sn: string;
  order_status: OrderStatus;
  booking_sn?: string; // FBS booking
}

// GET /api/v2/order/get_order_list Response
export interface GetOrderListResponse {
  error: string;
  message: string;
  request_id: string;
  response?: {
    more: boolean;
    order_list: OrderListItem[];
    next_cursor: string;
  };
}

// GET /api/v2/order/get_order_detail Request
export interface GetOrderDetailParams {
  order_sn_list: string[]; // Max 50 items
  response_optional_fields?: string;
}

// Item trong order detail
export interface OrderItem {
  item_id: number;
  item_name: string;
  item_sku: string;
  model_id: number;
  model_name: string;
  model_sku: string;
  model_quantity_purchased: number;
  model_original_price: number;
  model_discounted_price: number;
  wholesale: boolean;
  weight: number;
  add_on_deal: boolean;
  main_item: boolean;
  add_on_deal_id: number;
  promotion_type: string;
  promotion_id: number;
  order_item_id: number;
  promotion_group_id: number;
  image_info: {
    image_url: string;
  };
  product_location_id: string[];
  is_prescription_item: boolean;
  is_b2c_owned_item: boolean;
}

// Recipient address
export interface RecipientAddress {
  name: string;
  phone: string;
  town: string;
  district: string;
  city: string;
  state: string;
  region: string;
  zipcode: string;
  full_address: string;
}

// Package info
export interface PackageInfo {
  package_number: string;
  logistics_status: string;
  shipping_carrier: string;
  item_list: {
    item_id: number;
    model_id: number;
    order_item_id: number;
    promotion_group_id: number;
  }[];
}

// Order detail
export interface OrderDetail {
  order_sn: string;
  order_status: string;
  region: string;
  currency: string;
  cod: boolean;
  total_amount: number;
  shipping_carrier: string;
  payment_method: string;
  estimated_shipping_fee: number;
  message_to_seller: string;
  create_time: number;
  update_time: number;
  days_to_ship: number;
  ship_by_date: number;
  buyer_user_id: number;
  buyer_username: string;
  recipient_address: RecipientAddress;
  actual_shipping_fee: number;
  goods_to_declare: boolean;
  note: string;
  note_update_time: number;
  item_list: OrderItem[];
  pay_time: number;
  dropshipper: string;
  dropshipper_phone: string;
  split_up: boolean;
  buyer_cancel_reason: string;
  cancel_by: string;
  cancel_reason: string;
  actual_shipping_fee_confirmed: boolean;
  buyer_cpf_id: string;
  fulfillment_flag: string;
  pickup_done_time: number;
  package_list: PackageInfo[];
  invoice_data: {
    number: string;
    series_number: string;
    access_key: string;
    issue_date: number;
    total_value: number;
    products_total_value: number;
    tax_code: string;
  };
  checkout_shipping_carrier: string;
  reverse_shipping_fee: number;
  order_chargeable_weight_gram: number;
  edt_from: number;
  edt_to: number;
  prescription_images: string[];
  prescription_check_status: number;
}

// GET /api/v2/order/get_order_detail Response
export interface GetOrderDetailResponse {
  error: string;
  message: string;
  request_id: string;
  warning?: string;
  response?: {
    order_list: OrderDetail[];
  };
}

export interface GetShopProfileResponse {
  error: string;
  message: string;
  request_id: string;
  response?: ShopProfile;
}




// ==================== PAYMENT/ESCROW API TYPES ====================

// GET /api/v2/payment/get_escrow_detail Response
export interface EscrowItem {
  item_id: number;
  item_name: string;
  item_sku: string;
  model_id: number;
  model_name: string;
  model_sku: string;
  original_price: number;
  selling_price: number;
  discounted_price: number;
  seller_discount: number;
  shopee_discount: number;
  discount_from_coin: number;
  discount_from_voucher_shopee: number;
  discount_from_voucher_seller: number;
  quantity_purchased: number;
  activity_type: string;
  activity_id: number;
  is_main_item: boolean;
  is_b2c_shop_item: boolean;
  ams_commission_fee: number;
}

export interface OrderIncome {
  escrow_amount: number;
  buyer_total_amount: number;
  original_price: number;
  seller_discount: number;
  shopee_discount: number;
  voucher_from_seller: number;
  voucher_from_shopee: number;
  coins: number;
  buyer_paid_shipping_fee: number;
  buyer_transaction_fee: number;
  cross_border_tax: number;
  payment_promotion: number;
  commission_fee: number;
  service_fee: number;
  seller_transaction_fee: number;
  seller_lost_compensation: number;
  seller_coin_cash_back: number;
  escrow_tax: number;
  final_shipping_fee: number;
  actual_shipping_fee: number;
  estimated_shipping_fee: number;
  shopee_shipping_rebate: number;
  shipping_fee_discount_from_3pl: number;
  seller_shipping_discount: number;
  reverse_shipping_fee: number;
  final_product_protection: number;
  credit_card_promotion: number;
  credit_card_transaction_fee: number;
  campaign_fee: number;
  seller_return_refund: number;
  drc_adjustable_refund: number;
  cost_of_goods_sold: number;
  original_cost_of_goods_sold: number;
  order_selling_price: number;
  order_discounted_price: number;
  order_original_price: number;
  order_seller_discount: number;
  items: EscrowItem[];
  escrow_amount_after_adjustment: number;
  total_adjustment_amount: number;
  order_ams_commission_fee: number;
  buyer_payment_method: string;
  instalment_plan: string;
  final_escrow_product_gst: number;
  withholding_tax: number;
  withholding_vat_tax: number;
  withholding_pit_tax: number;
  seller_order_processing_fee: number;
  shipping_seller_protection_fee_amount: number;
}

export interface BuyerPaymentInfo {
  buyer_payment_method: string;
  buyer_total_amount: number;
  merchant_subtotal: number;
  shipping_fee: number;
  seller_voucher: number;
  shopee_voucher: number;
  shopee_coins_redeemed: number;
  credit_card_promotion: number;
  buyer_service_fee: number;
  buyer_tax_amount: number;
  insurance_premium: number;
  is_paid_by_credit_card: boolean;
}

export interface GetEscrowDetailResponse {
  error: string;
  message: string;
  request_id: string;
  response?: {
    order_sn: string;
    buyer_user_name: string;
    return_order_sn_list: string[];
    order_income: OrderIncome;
    buyer_payment_info?: BuyerPaymentInfo;
  };
}


// GET /api/v2/payment/get_escrow_list Response
export interface EscrowListItem {
  order_sn: string;
  payout_amount: number;
  escrow_release_time: number;
}

export interface GetEscrowListResponse {
  error: string;
  message: string;
  request_id: string;
  response?: {
    more: boolean;
    escrow_list: EscrowListItem[];
  };
}


// ==================== LOGISTICS/TRACKING API TYPES ====================

// Tracking event trong lịch sử
export interface TrackingEvent {
  update_time: number;
  description: string;
  logistics_status: string;
}

// GET /api/v2/logistics/get_tracking_info Response
export interface GetTrackingInfoResponse {
  error: string;
  message: string;
  request_id: string;
  response?: {
    order_sn: string;
    package_number: string;
    logistics_status: string;
    tracking_info: TrackingEvent[];
  };
}
