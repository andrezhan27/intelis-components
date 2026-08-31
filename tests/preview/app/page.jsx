'use client';
import { useState } from 'react';
import { PromotionBannerClient } from '../../../src/promotion-banner/promotion-banner-client';
const connection = { supabaseUrl: 'http://127.0.0.1:3111', supabasePublishableKey: 'sb_publishable_fixture' };
export default function Preview() {
  const [status, setStatus] = useState('Local test data — no restaurant records are changed.');
  async function run(action) {
    const result = await (await fetch(`/fixture/${action}`, { method: 'POST' })).json();
    setStatus(`${result.action}: ${result.connected} live connection; ${result.requests} fetches`);
  }
  return <>
    <PromotionBannerClient restaurantId="preview" connection={connection} initialSnapshot={null} ariaLabel="Restaurant promotions" />
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '72px 24px' }}>
      <p style={{ letterSpacing: '0.2em', fontSize: 12 }}>BANNER INTERACTION PREVIEW</p>
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 48 }}>Good things, worth sharing.</h1>
      <p>Five-second rotation. One steady background. Live updates.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 40 }}>
        {[['reset','Reset banners'], ['urgent','Add urgent notice'], ['edit','Edit lunch offer'], ['empty','Disable all'], ['schedule','Schedule an offer'], ['fail','Toggle API outage']].map(([action, label]) =>
          <button key={action} onClick={() => run(action)} style={{ padding: '12px 18px', border: '1px solid #bdc6b7', borderRadius: 8, background: 'white', font: 'inherit' }}>{label}</button>)}
      </div>
      <p role="status" style={{ fontSize: 14, marginTop: 24 }}>{status}</p>
      <p><a href="/server">Server-rendered package test</a></p>
      <p style={{ fontSize: 14 }}>Dismissal lasts for this tab’s session. Reload to check that dismissed offers stay hidden.</p>
    </main>
  </>;
}
