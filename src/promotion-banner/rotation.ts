import type { ScheduledPromotion } from "./types.js";

/** RPC order is authoritative. Urgent notices stay pinned until removed/dismissed. */
export function visiblePromotions(
  promotions: ScheduledPromotion[],
  dismissed: ReadonlySet<string>,
  now: number,
): ScheduledPromotion[] {
  const available = promotions.filter((promotion) =>
    !(promotion.dismissible && dismissed.has(promotion.id)) &&
    (promotion.endsAt === null || Date.parse(promotion.endsAt) > now),
  );
  const urgent = available.find((promotion) => promotion.variant === "urgent");
  return urgent ? [urgent] : available;
}

export function rotationInterval(value = 5000): number {
  return Number.isFinite(value) ? Math.min(2_147_000_000, Math.max(3000, value)) : 5000;
}
