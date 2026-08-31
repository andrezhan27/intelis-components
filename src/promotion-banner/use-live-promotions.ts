"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { fetchPromotionSnapshot } from "./data.js";
import type { PromotionConnection, PromotionSnapshot, ScheduledPromotion } from "./types.js";

export function useLivePromotions(
  restaurantId: string,
  connection: PromotionConnection,
  initialSnapshot: PromotionSnapshot | null,
) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => initialSnapshot ? Date.parse(initialSnapshot.serverTime) : Date.now());

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let pending = false;
    let scheduleTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    let controller: AbortController | undefined;
    let clockOffset = initialSnapshot ? Date.parse(initialSnapshot.serverTime) - Date.now() : 0;

    function scheduleExpiry(promotions: ScheduledPromotion[]) {
      clearTimeout(expiryTimer);
      const serverNow = Date.now() + clockOffset;
      const ends = promotions.flatMap((p) => p.endsAt ? [Date.parse(p.endsAt)] : [])
        .filter((end) => end > serverNow);
      if (!ends.length) return;
      expiryTimer = setTimeout(() => {
        setNow(Date.now() + clockOffset);
        scheduleExpiry(promotions);
      }, Math.max(1, Math.min(2_147_000_000, Math.min(...ends) - serverNow)));
    }

    function schedule(next: PromotionSnapshot) {
      clearTimeout(scheduleTimer);
      if (!next.nextChangeAt) return;
      const delay = Math.max(50, Math.min(2_147_000_000,
        Date.parse(next.nextChangeAt) - (Date.now() + clockOffset)));
      scheduleTimer = setTimeout(() => {
        setNow(Date.now() + clockOffset); // Expire locally even if offline.
        void refresh();
      }, delay);
    }

    async function refresh() {
      if (stopped) return;
      if (inFlight) { pending = true; return; }
      clearTimeout(retryTimer);
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      const next = await fetchPromotionSnapshot(restaurantId, { ...connection, signal: controller.signal });
      clearTimeout(timeout);
      inFlight = false;
      if (stopped) return;
      if (next) {
        retryDelay = 1000;
        clockOffset = Date.parse(next.serverTime) - Date.now();
        setSnapshot(next);
        schedule(next);
        scheduleExpiry(next.promotions);
      } else {
        retryTimer = setTimeout(() => void refresh(), retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
      setNow(Date.now() + clockOffset);
      if (pending) { pending = false; void refresh(); }
    }

    const client = createClient(connection.supabaseUrl, connection.supabasePublishableKey, {
      // No Auth client or session storage: these are public website reads.
      accessToken: async () => connection.supabasePublishableKey.startsWith("sb_publishable_")
        ? null : connection.supabasePublishableKey,
    });
    const channel = client.channel(`restaurant-promotions:${restaurantId}`, { config: { private: false } })
      // Public broadcasts only invalidate; fetch the authoritative data.
      .on("broadcast", { event: "promotions_changed" }, () => void refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    if (initialSnapshot) {
      schedule(initialSnapshot);
      scheduleExpiry(initialSnapshot.promotions);
    }
    void refresh(); // Closes SSR/hydration and read/subscribe gaps.
    const resume = () => {
      if (!document.hidden) { setNow(Date.now() + clockOffset); void refresh(); }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    const fallback = setInterval(resume, 30_000);
    return () => {
      stopped = true;
      controller?.abort();
      clearTimeout(scheduleTimer);
      clearTimeout(retryTimer);
      clearTimeout(expiryTimer);
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      void client.removeChannel(channel);
    };
  }, [restaurantId, connection.supabaseUrl, connection.supabasePublishableKey, initialSnapshot]);

  return { promotions: snapshot?.promotions ?? [], now };
}
