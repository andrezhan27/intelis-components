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

export type ScheduledPromotion = ActivePromotion & { endsAt: string | null };

export type PromotionSnapshot = {
  promotions: ScheduledPromotion[];
  serverTime: string;
  nextChangeAt: string | null;
};

export type PromotionConnection = {
  supabaseUrl: string;
  supabasePublishableKey: string;
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
  /** @deprecated Promotion requests always use `cache: "no-store"`. */
  revalidateSeconds?: number;
  fetchImplementation?: typeof fetch;
  logger?: Pick<Console, "error">;
  signal?: AbortSignal;
};

export type PromotionBannerProps = PromotionFetchOptions & {
  restaurantId: string;
  ariaLabel?: string;
  className?: string;
  style?: PromotionBannerStyle;
  /** Defaults to 5000ms. Values below 3000ms are clamped for readability. */
  rotationIntervalMs?: number;
};
