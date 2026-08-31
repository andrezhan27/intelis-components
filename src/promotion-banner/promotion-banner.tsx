import "server-only";

import { fetchPromotionSnapshot, resolvePromotionConnection } from "./data.js";
import { PromotionBannerClient } from "./promotion-banner-client.js";
import type { PromotionBannerProps } from "./types.js";

export async function PromotionBanner({
  restaurantId,
  ariaLabel = "Promotion",
  className,
  style,
  rotationIntervalMs,
  ...fetchOptions
}: PromotionBannerProps) {
  const options = { ...fetchOptions, logger: fetchOptions.logger ?? console };
  const connection = resolvePromotionConnection(options);
  if (!connection || !restaurantId.trim()) return null;
  const snapshot = await fetchPromotionSnapshot(restaurantId, options);

  return (
    <PromotionBannerClient
      key={restaurantId.trim()}
      restaurantId={restaurantId.trim()}
      connection={connection}
      initialSnapshot={snapshot}
      rotationIntervalMs={rotationIntervalMs}
      ariaLabel={ariaLabel}
      className={className}
      style={style}
    />
  );
}
