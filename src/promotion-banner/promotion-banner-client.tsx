"use client";

import { useEffect, useState } from "react";
import { PromotionBannerView } from "./promotion-banner-view.js";
import type { ActivePromotion, PromotionBannerStyle } from "./types.js";

type PromotionBannerClientProps = {
  promotion: ActivePromotion;
  ariaLabel: string;
  className?: string;
  style?: PromotionBannerStyle;
};

function dismissalKey(promotionId: string) {
  return `restaurant-promotion-dismissed:${promotionId}`;
}

export function PromotionBannerClient({
  promotion,
  ariaLabel,
  className,
  style,
}: PromotionBannerClientProps) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissalKey(promotion.id)) === "1");
    } catch {
      setDismissed(false);
    } finally {
      setReady(true);
    }
  }, [promotion.id]);

  if (!ready || dismissed) return null;

  return (
    <PromotionBannerView
      ariaLabel={ariaLabel}
      className={className}
      promotion={promotion}
      style={style}
      onDismiss={() => {
        try {
          localStorage.setItem(dismissalKey(promotion.id), "1");
        } catch {
          // A blocked storage API should never break the restaurant website.
        }
        setDismissed(true);
      }}
    />
  );
}
