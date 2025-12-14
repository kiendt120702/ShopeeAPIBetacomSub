/**
 * Panel Components Export
 *
 * Chuyển đổi giữa V1 (gọi API trực tiếp) và V2 (đọc từ DB)
 * Set USE_V2_PANELS = true để dùng kiến trúc mới
 */

// Feature flag - set true để dùng V2
const USE_V2_PANELS = true;

// V1 Components (gọi API trực tiếp)
import AdsPanelV1 from './AdsPanel';
import FlashSalePanelV1 from './FlashSalePanel';

// V2 Components (đọc từ DB + Realtime)
import AdsPanelV2 from './AdsPanelV2';
import FlashSalePanelV2 from './FlashSalePanelV2';

// Export based on feature flag
export const AdsPanel = USE_V2_PANELS ? AdsPanelV2 : AdsPanelV1;
export const FlashSalePanel = USE_V2_PANELS ? FlashSalePanelV2 : FlashSalePanelV1;

// Admin panels
export { default as PartnerAccountsPanel } from './PartnerAccountsPanel';

// Also export individual versions for testing
export { AdsPanelV1, AdsPanelV2, FlashSalePanelV1, FlashSalePanelV2 };
