import type { CSSProperties } from "react";

export const promotionVariants = [
  "default",
  "announcement",
  "promotion",
  "urgent",
] as const;

export type PromotionVariant = (typeof promotionVariants)[number];

export type ActivePromotion = {
  id: string;
  message: string;
  linkUrl: string | null;
  linkText: string | null;
  dismissible: boolean;
  variant: PromotionVariant;
};

export type PromotionBannerStyle = CSSProperties & {
  "--promotion-banner-bg"?: string;
  "--promotion-banner-text"?: string;
  "--promotion-banner-link"?: string;
  "--promotion-banner-border"?: string;
};

export type PromotionFetchOptions = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  revalidateSeconds?: number;
  fetchImplementation?: typeof fetch;
  logger?: Pick<Console, "error">;
};

export type PromotionBannerProps = PromotionFetchOptions & {
  restaurantId: string;
  ariaLabel?: string;
  className?: string;
  style?: PromotionBannerStyle;
};
