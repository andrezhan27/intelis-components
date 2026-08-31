"use client";

import { useEffect, useState } from "react";
import { PromotionBannerView } from "./promotion-banner-view.js";
import { rotationInterval, visiblePromotions } from "./rotation.js";
import { useLivePromotions } from "./use-live-promotions.js";
import type { PromotionConnection, PromotionSnapshot, PromotionBannerStyle, PromotionVariant } from "./types.js";

type PromotionBannerClientProps = {
  restaurantId: string;
  connection: PromotionConnection;
  initialSnapshot: PromotionSnapshot | null;
  rotationIntervalMs?: number;
  ariaLabel: string;
  className?: string;
  style?: PromotionBannerStyle;
};

export function PromotionBannerClient({
  restaurantId, connection, initialSnapshot, rotationIntervalMs,
  ariaLabel, className, style,
}: PromotionBannerClientProps) {
  const { promotions, now } = useLivePromotions(restaurantId, connection, initialSnapshot);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [backgroundVariant, setBackgroundVariant] = useState<PromotionVariant | null>(() =>
    visiblePromotions(initialSnapshot?.promotions ?? [], new Set(), now)[0]?.variant ?? null);
  const storageKey = `restaurant-promotion-session:${restaurantId}`;

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(stored)) setDismissed(new Set(stored.filter((id): id is string => typeof id === "string")));
    } catch { /* Blocked storage still permits dismissal for this page. */ }
    setReady(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionChanged = () => setReducedMotion(media.matches);
    const visibilityChanged = () => setHidden(document.hidden);
    motionChanged();
    visibilityChanged();
    media.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      media.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [storageKey]);

  const available = visiblePromotions(promotions, dismissed, now);
  const active = available.find((p) => p.id === activeId) ?? available[0];
  const activeIndex = active ? available.indexOf(active) : 0;
  const ids = available.map((p) => p.id).join(",");
  const interval = rotationInterval(rotationIntervalMs);
  const automatic = ready && available.length > 1 && !paused && !hovered && !focused && !hidden && !reducedMotion;

  useEffect(() => {
    if (active && backgroundVariant === null) setBackgroundVariant(active.variant);
  }, [active, backgroundVariant]);

  useEffect(() => {
    if (!automatic) return;
    const timer = setTimeout(() => {
      const ordered = ids.split(",");
      const index = ordered.indexOf(active?.id ?? "");
      setActiveId(ordered[(index + 1) % ordered.length]);
    }, interval);
    return () => clearTimeout(timer);
  }, [automatic, ids, active?.id, interval]);

  // Avoid briefly showing a previously dismissed promotion during hydration.
  if (!active || (!ready && promotions.some((p) => p.dismissible))) return null;

  function advance(direction: number) {
    setPaused(true);
    setActiveId(available[(activeIndex + direction + available.length) % available.length].id);
  }

  return (
    <PromotionBannerView
      promotions={available}
      activeIndex={activeIndex}
      backgroundVariant={backgroundVariant ?? active.variant}
      ariaLabel={ariaLabel}
      className={className}
      style={style}
      automatic={automatic}
      paused={paused || reducedMotion}
      reducedMotion={reducedMotion}
      onHover={setHovered}
      onFocusWithin={setFocused}
      onPrevious={() => advance(-1)}
      onNext={() => advance(1)}
      onToggleRotation={() => { setPaused((value) => !value); setFocused(false); }}
      onDismiss={active.dismissible ? () => {
        const next = new Set(dismissed).add(active.id);
        const remaining = visiblePromotions(promotions, next, now);
        const followingId = available[(activeIndex + 1) % available.length]?.id;
        setActiveId(remaining.find((p) => p.id === followingId)?.id ?? remaining[0]?.id ?? null);
        setDismissed(next);
        setFocused(false);
        try { sessionStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* Best effort. */ }
      } : undefined}
    />
  );
}
