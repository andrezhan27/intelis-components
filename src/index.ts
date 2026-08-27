export { PromotionBanner } from "./promotion-banner/promotion-banner.js";
export {
  fetchActivePromotion,
  normalizeActivePromotion,
  promotionCacheTag,
} from "./promotion-banner/data.js";
export { isSafePromotionUrl } from "./promotion-banner/safe-url.js";
export type {
  ActivePromotion,
  PromotionBannerProps,
  PromotionFetchOptions,
  PromotionVariant,
} from "./promotion-banner/types.js";
