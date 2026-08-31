import { PromotionBanner } from '../../../../dist/index.js';
export default function ServerPreview() {
  return <>
    <PromotionBanner restaurantId="preview" supabaseUrl="http://127.0.0.1:3111" supabasePublishableKey="sb_publishable_fixture" />
    <main style={{ padding: 40 }}><h1>Server-rendered package smoke test</h1><a href="/">Open fixture controls</a></main>
  </>;
}
