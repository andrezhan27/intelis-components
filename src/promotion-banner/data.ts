import {
  promotionVariants,
  type ActivePromotion,
  type PromotionFetchOptions,
  type PromotionVariant,
  type PromotionConnection,
  type PromotionSnapshot,
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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPromotionVariant(value: unknown): value is PromotionVariant {
  return (
    typeof value === "string" &&
    (promotionVariants as readonly string[]).includes(value)
  );
}

/** @deprecated Promotion requests are no longer cached. */
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

  const requestUrl = new URL(
    `${supabaseUrl}/rest/v1/rpc/get_active_restaurant_promotion`,
  );
  requestUrl.searchParams.set("p_restaurant_id", normalizedRestaurantId);

  const requestInit: RequestInit = {
    cache: "no-store",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      Accept: "application/json",
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

/** Only public credentials may cross the server/client boundary. */
export function resolvePromotionConnection(options: PromotionFetchOptions): PromotionConnection | null {
  const supabaseUrl = (options.supabaseUrl ?? process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const key = options.supabasePublishableKey ?? process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !key) return null;
  try {
    if (!["https:", "http:"].includes(new URL(supabaseUrl).protocol)) return null;
  } catch { return null; }
  let isPublic = key.startsWith("sb_publishable_");
  if (!isPublic) {
    try {
      const payload = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      isPublic = JSON.parse(atob(payload)).role === "anon";
    } catch { /* Secret keys and malformed JWTs must never be serialized. */ }
  }
  if (!isPublic) {
    options.logger?.error("Promotion live updates require a publishable or legacy anon key.");
    return null;
  }
  return { supabaseUrl, supabasePublishableKey: key };
}

export function normalizePromotionSnapshot(value: unknown): PromotionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const isTimestamp = (v: unknown): v is string =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  if (!Array.isArray(row.promotions) || !isTimestamp(row.server_time) ||
    !(row.next_change_at === null || isTimestamp(row.next_change_at))) return null;
  const seen = new Set<string>();
  const promotions = row.promotions.flatMap((item: unknown) => {
    const promotion = normalizeActivePromotion(item);
    if (!promotion || seen.has(promotion.id)) return [];
    const end = (item as Record<string, unknown>).ends_at;
    if (!(end === null || isTimestamp(end))) return [];
    seen.add(promotion.id);
    return [{ ...promotion, endsAt: end }];
  });
  return { promotions, serverTime: row.server_time, nextChangeAt: row.next_change_at };
}

/** null means unavailable; an empty promotions array is an authoritative removal. */
export async function fetchPromotionSnapshot(
  restaurantId: string,
  options: PromotionFetchOptions = {},
): Promise<PromotionSnapshot | null> {
  const connection = resolvePromotionConnection(options);
  if (!connection || !restaurantId.trim()) return null;
  try {
    const url = new URL(`${connection.supabaseUrl}/rest/v1/rpc/get_restaurant_promotion_state`);
    url.searchParams.set("p_restaurant_id", restaurantId.trim());
    const key = connection.supabasePublishableKey;
    const response = await (options.fetchImplementation ?? fetch)(url, {
      cache: "no-store", signal: options.signal ?? AbortSignal.timeout(10_000),
      headers: {
        apikey: key,
        ...(!key.startsWith("sb_publishable_") ? { Authorization: `Bearer ${key}` } : {}),
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Promotion request failed: ${response.status}`);
    return normalizePromotionSnapshot(await response.json());
  } catch (error) {
    options.logger?.error("Unable to load restaurant promotions", error);
    return null;
  }
}
