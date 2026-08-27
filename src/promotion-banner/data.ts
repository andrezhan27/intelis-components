import {
  promotionVariants,
  type ActivePromotion,
  type PromotionFetchOptions,
  type PromotionVariant,
} from "./types.js";
import { isSafePromotionUrl } from "./safe-url.js";

type RpcPromotionRow = {
  id?: unknown;
  message?: unknown;
  link_url?: unknown;
  link_text?: unknown;
  dismissible?: unknown;
  variant?: unknown;
};

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPromotionVariant(value: unknown): value is PromotionVariant {
  return (
    typeof value === "string" &&
    (promotionVariants as readonly string[]).includes(value)
  );
}

export function promotionCacheTag(restaurantId: string): string {
  return `promotion:${restaurantId.trim().slice(0, 220)}`;
}

export function normalizeActivePromotion(value: unknown): ActivePromotion | null {
  if (!value || typeof value !== "object") return null;

  const row = value as RpcPromotionRow;
  if (typeof row.id !== "string" || !uuidPattern.test(row.id)) return null;
  if (typeof row.message !== "string") return null;

  const message = row.message.trim();
  if (!message || message.length > 280) return null;
  if (typeof row.dismissible !== "boolean") return null;
  if (!isPromotionVariant(row.variant)) return null;

  const linkUrl =
    typeof row.link_url === "string" && isSafePromotionUrl(row.link_url)
      ? row.link_url
      : null;
  const normalizedLinkText =
    typeof row.link_text === "string" ? row.link_text.trim() : "";
  const linkText =
    linkUrl && normalizedLinkText && normalizedLinkText.length <= 80
      ? normalizedLinkText
      : null;

  return {
    id: row.id,
    message,
    linkUrl,
    linkText,
    dismissible: row.dismissible,
    variant: row.variant,
  };
}

export async function fetchActivePromotion(
  restaurantId: string,
  options: PromotionFetchOptions = {},
): Promise<ActivePromotion | null> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return null;

  const supabaseUrl = (
    options.supabaseUrl ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.replace(/\/$/, "");
  const publishableKey =
    options.supabasePublishableKey ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) return null;

  const revalidate = Math.max(1, options.revalidateSeconds ?? 120);
  const requestUrl = new URL(
    `${supabaseUrl}/rest/v1/rpc/get_active_restaurant_promotion`,
  );
  requestUrl.searchParams.set("p_restaurant_id", normalizedRestaurantId);

  const requestInit: NextFetchInit = {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Accept: "application/json",
    },
    next: {
      revalidate,
      tags: [promotionCacheTag(normalizedRestaurantId)],
    },
  };

  try {
    const response = await (options.fetchImplementation ?? fetch)(
      requestUrl,
      requestInit,
    );

    if (!response.ok) {
      options.logger?.error(
        `Unable to load restaurant promotion: ${response.status}`,
      );
      return null;
    }

    const payload = (await response.json()) as unknown;
    const row = Array.isArray(payload) ? payload[0] : payload;
    return normalizeActivePromotion(row);
  } catch (error) {
    options.logger?.error("Unable to load restaurant promotion", error);
    return null;
  }
}
