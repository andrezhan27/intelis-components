import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchActivePromotion,
  normalizeActivePromotion,
} from "../dist/promotion-banner/data.js";
import { isSafePromotionUrl } from "../dist/promotion-banner/safe-url.js";

const validRow = {
  id: "c920cf4d-5658-4b74-a4b8-130749ba3a34",
  message: "Lunch offer",
  link_url: "/offers",
  link_text: "View offer",
  dismissible: true,
  variant: "promotion",
};

test("accepts root-relative and HTTPS promotion URLs", () => {
  assert.equal(isSafePromotionUrl("/offers?day=today"), true);
  assert.equal(isSafePromotionUrl("https://example.com/summer"), true);
});

test("rejects dangerous and protocol-relative URLs", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "//example.com",
    "/safe path",
  ]) {
    assert.equal(isSafePromotionUrl(value), false, value);
  }
});

test("normalizes the narrow RPC contract", () => {
  assert.deepEqual(normalizeActivePromotion(validRow), {
    id: validRow.id,
    message: "Lunch offer",
    linkUrl: "/offers",
    linkText: "View offer",
    dismissible: true,
    variant: "promotion",
  });
});

test("drops a malformed link without dropping safe banner text", () => {
  assert.deepEqual(
    normalizeActivePromotion({
      ...validRow,
      link_url: "javascript:alert(1)",
      link_text: "Bad",
    }),
    {
      id: validRow.id,
      message: "Lunch offer",
      linkUrl: null,
      linkText: null,
      dismissible: true,
      variant: "promotion",
    },
  );
});

test("fetches the read-only RPC without caching", async () => {
  let capturedUrl;
  let capturedInit;
  const promotion = await fetchActivePromotion(" restaurant-a ", {
    supabaseUrl: "https://project.supabase.co/",
    supabasePublishableKey: "publishable-key",
    revalidateSeconds: 90,
    fetchImplementation: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify([validRow]), { status: 200 });
    },
  });

  assert.equal(promotion?.id, validRow.id);
  assert.match(capturedUrl, /get_active_restaurant_promotion/);
  assert.match(capturedUrl, /p_restaurant_id=restaurant-a/);
  assert.equal(capturedInit.cache, "no-store");
  assert.equal(capturedInit.next, undefined);
});

test("fails closed when the RPC is unavailable or malformed", async () => {
  const unavailable = await fetchActivePromotion("restaurant-a", {
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "publishable-key",
    fetchImplementation: async () => new Response("no", { status: 503 }),
  });
  assert.equal(unavailable, null);

  const malformed = await fetchActivePromotion("restaurant-a", {
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "publishable-key",
    fetchImplementation: async () =>
      new Response(JSON.stringify([{ message: "missing id" }]), { status: 200 }),
  });
  assert.equal(malformed, null);
});
