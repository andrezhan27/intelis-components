import "server-only";

import { fetchActivePromotion } from "./data.js";
import { PromotionBannerClient } from "./promotion-banner-client.js";
import { PromotionBannerView } from "./promotion-banner-view.js";
import type { PromotionBannerProps } from "./types.js";

export async function PromotionBanner({
  restaurantId,
  ariaLabel = "Promotion",
  className,
  style,
  ...fetchOptions
}: PromotionBannerProps) {
  const promotion = await fetchActivePromotion(restaurantId, {
    ...fetchOptions,
    logger: fetchOptions.logger ?? console,
  });

  if (!promotion) return null;

  if (promotion.dismissible) {
    return (
      <PromotionBannerClient
        ariaLabel={ariaLabel}
        className={className}
        promotion={promotion}
        style={style}
      />
    );
  }

  return (
    <PromotionBannerView
      ariaLabel={ariaLabel}
      className={className}
      promotion={promotion}
      style={style}
    />
  );
}
