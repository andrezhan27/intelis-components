// Usage: node tests/realtime-probe.mjs /path/to/public-connection.json
// While READY, send an empty promotions_changed event to the probe topic via SQL.
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { fetchPromotionSnapshot } from '../dist/promotion-banner/data.js';
const connection = JSON.parse(await readFile(process.argv[2], 'utf8'));
const result = await fetchPromotionSnapshot('__banner_delivery_probe__', connection);
if (!result || result.promotions.length !== 0) throw new Error('Public snapshot API failed');
console.log('Public snapshot API passed');
const client = createClient(connection.supabaseUrl, connection.supabasePublishableKey, {
  accessToken: async () => connection.supabasePublishableKey.startsWith('sb_publishable_') ? null : connection.supabasePublishableKey,
});
const timeout = setTimeout(() => { console.error('Timed out waiting for broadcast'); process.exit(1); }, 25000);
client.channel('restaurant-promotions:__banner_delivery_probe__', { config: { private: false } })
  .on('broadcast', { event: 'promotions_changed' }, async ({ payload }) => {
    // Supabase adds its delivery ID to an otherwise empty database payload.
    if (Object.keys(payload).some(key => key !== 'id')) throw new Error('Unexpected broadcast content');
    console.log('PASS: database broadcast delivered to anonymous public client');
    clearTimeout(timeout);
    await client.removeAllChannels();
    process.exit(0);
  })
  .subscribe(status => console.log(status === 'SUBSCRIBED' ? 'READY' : status));
