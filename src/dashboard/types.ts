import type { PromotionVariant } from "../promotion-banner/types.js";

export type RestaurantPromotion = {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  message: string;
  link_url: string | null;
  link_text: string | null;
  starts_at: string | null;
  ends_at: string | null;
  dismissible: boolean;
  variant: PromotionVariant;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type PromotionDraft = {
  id: string | null;
  enabled: boolean;
  message: string;
  linkUrl: string;
  linkText: string;
  startsAt: string;
  endsAt: string;
  dismissible: boolean;
  variant: PromotionVariant;
  priority: number;
};

export type PromotionValidationErrors = Partial<
  Record<keyof PromotionDraft, string>
>;
