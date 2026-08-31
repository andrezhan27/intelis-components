import assert from 'node:assert/strict';
import test from 'node:test';
import { visiblePromotions, rotationInterval } from '../dist/promotion-banner/rotation.js';
import { fetchPromotionSnapshot, normalizePromotionSnapshot, resolvePromotionConnection } from '../dist/promotion-banner/data.js';

const regular = { id: 'c920cf4d-5658-4b74-a4b8-130749ba3a34', message: 'Lunch offer', dismissible: true, variant: 'promotion', linkUrl: '/lunch', linkText: 'Lunch menu', endsAt: null };
const second = { ...regular, id: '9937b9e8-76e4-4f62-aedb-0306b63ac5bf', message: 'Dinner offer' };
const now = Date.parse('2026-08-31T12:00:00Z');

test('keeps database order and removes only individually dismissed, dismissible banners', () => {
  assert.deepEqual(visiblePromotions([regular, second], new Set(), now), [regular, second]);
  assert.deepEqual(visiblePromotions([regular, second], new Set([regular.id]), now), [second]);
  const required = { ...regular, dismissible: false };
  assert.deepEqual(visiblePromotions([required], new Set([regular.id]), now), [required]);
});

test('highest ranked urgent overrides ordinary banners until dismissed or expired', () => {
  const urgent = { ...second, variant: 'urgent', endsAt: '2026-08-31T12:00:01Z' };
  const lowerUrgent = { ...urgent, id: 'another' };
  assert.deepEqual(visiblePromotions([regular, urgent, lowerUrgent], new Set(), now), [urgent]);
  assert.deepEqual(visiblePromotions([regular, urgent], new Set([urgent.id]), now), [regular]);
  assert.deepEqual(visiblePromotions([regular, urgent], new Set(), now + 1000), [regular]);
});

test('expires at the exclusive boundary and handles zero banners', () => {
  assert.deepEqual(visiblePromotions([{ ...regular, endsAt: new Date(now).toISOString() }], new Set(), now), []);
  assert.deepEqual(visiblePromotions([], new Set(), now), []);
});

test('defaults to five seconds and rejects unreadably short/nonfinite intervals', () => {
  assert.equal(rotationInterval(), 5000);
  assert.equal(rotationInterval(100), 3000);
  assert.equal(rotationInterval(NaN), 5000);
  assert.equal(rotationInterval(Infinity), 5000);
  assert.equal(rotationInterval(8000), 8000);
  assert.equal(rotationInterval(1e12), 2_147_000_000);
});

const row = { id: regular.id, message: regular.message, link_url: '/lunch', link_text: 'Lunch menu', variant: 'promotion', dismissible: true, ends_at: null };
const snapshot = { server_time: new Date(now).toISOString(), next_change_at: null, promotions: [row] };

test('validates snapshot metadata, removes invalid rows and duplicates, and preserves order', () => {
  assert.equal(normalizePromotionSnapshot({ ...snapshot, server_time: 'wrong' }), null);
  const parsed = normalizePromotionSnapshot({ ...snapshot, promotions: [row, row, { ...row, id: second.id }, { ...row, id: 'bad' }] });
  assert.deepEqual(parsed.promotions.map(p => p.id), [regular.id, second.id]);
  assert.equal(normalizePromotionSnapshot({ ...snapshot, promotions: [{ ...row, ends_at: 'wrong' }] }).promotions.length, 0);
});

test('never serializes a service-role or secret key to the browser', () => {
  const options = { supabaseUrl: 'https://example.supabase.co' };
  const jwt = role => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(resolvePromotionConnection({ ...options, supabasePublishableKey: jwt('service_role') }), null);
  assert.equal(resolvePromotionConnection({ ...options, supabasePublishableKey: 'sb_secret_test' }), null);
  assert.ok(resolvePromotionConnection({ ...options, supabasePublishableKey: jwt('anon') }));
  assert.ok(resolvePromotionConnection({ ...options, supabasePublishableKey: 'sb_publishable_test' }));
  assert.equal(resolvePromotionConnection({ supabaseUrl: 'invalid', supabasePublishableKey: 'sb_publishable_test' }), null);
});

test('distinguishes a live removal from network failure and uses no-store with public headers', async () => {
  const options = { supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'sb_publishable_test' };
  const result = await fetchPromotionSnapshot('restaurant-a', { ...options, fetchImplementation: async (url, init) => {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/get_restaurant_promotion_state');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, undefined);
    return new Response(JSON.stringify({ ...snapshot, promotions: [] }));
  }});
  assert.deepEqual(result.promotions, []);
  assert.equal(await fetchPromotionSnapshot('restaurant-a', { ...options, fetchImplementation: async () => new Response('', { status: 503 }) }), null);
});
