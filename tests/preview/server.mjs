// Local-only integration fixture: exercises the real Supabase client over a
// minimal Phoenix Broadcast connection. Never connects to a real database.
import http from 'node:http';
import { createRequire } from 'node:module';
import next from 'next';
const require = createRequire(import.meta.url);
const { WebSocketServer } = require('next/dist/compiled/ws');
const port = 3111;
const app = next({ dev: true, dir: new URL('.', import.meta.url).pathname, hostname: '127.0.0.1', port, webpack: true });
await app.prepare();
const handle = app.getRequestHandler();
const upgrade = app.getUpgradeHandler();
const original = [
  { id: 'c920cf4d-5658-4b74-a4b8-130749ba3a34', message: 'A little more time around the table. Enjoy our weekday lunch menu.', link_url: '/lunch', link_text: 'Explore lunch', enabled: true, dismissible: true, variant: 'promotion', ends_at: null },
  { id: '9937b9e8-76e4-4f62-aedb-0306b63ac5bf', message: 'Friday evenings, live music and something delicious.', link_url: '/music', link_text: 'See what’s on', enabled: true, dismissible: true, variant: 'announcement', ends_at: null },
  { id: 'cbd2f6db-b2cf-4f5b-a85d-ea52e741292c', message: 'Welcome to the neighbourhood. Our terrace is open every afternoon.', link_url: null, link_text: null, enabled: true, dismissible: false, variant: 'default', ends_at: null },
];
let rows = structuredClone(original);
let failing = false;
let requests = 0;
const sockets = new Map();
function invalidate() {
  for (const [ws, topic] of sockets) if (ws.readyState === 1) ws.send(JSON.stringify([null, null, topic, 'broadcast', { event: 'promotions_changed', payload: {}, type: 'broadcast' }]));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/rest/v1/rpc/get_restaurant_promotion_state') {
    requests++;
    if (failing) { res.writeHead(503).end(); return; }
    const now = Date.now();
    const enabled = rows.filter(r => r.enabled && (!r.ends_at || Date.parse(r.ends_at) > now));
    const upcoming = enabled.flatMap(r => [r.starts_at, r.ends_at]).filter(t => t && Date.parse(t) > now).sort();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ server_time: new Date(now).toISOString(), next_change_at: upcoming[0] ?? null, promotions: enabled.filter(r => !r.starts_at || Date.parse(r.starts_at) <= now) }));
    return;
  }
  if (req.method === 'POST' && url.pathname.startsWith('/fixture/')) {
    const action = url.pathname.split('/').at(-1);
    if (action === 'reset') { rows = structuredClone(original); failing = false; }
    if (action === 'urgent') rows.push({ ...original[0], id: '0913f58b-9f88-4689-8f92-ce876cc62b2e', variant: 'urgent', message: 'Urgent: the terrace is temporarily closed.', link_url: '/notice', link_text: 'Read the update' });
    if (action === 'edit') rows[0] = { ...rows[0], message: 'Updated just now: a new seasonal lunch menu.', link_url: '/new-menu', link_text: 'View new menu' };
    if (action === 'empty') rows = [];
    if (action === 'schedule') rows = [{ ...original[0], id: 'bc43246a-e70a-4c75-a855-f7d89cd6b812', message: 'Scheduled offer is now active.', starts_at: new Date(Date.now() + 2000).toISOString(), ends_at: new Date(Date.now() + 7000).toISOString() }];
    if (action === 'fail') failing = !failing;
    invalidate();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ action, requests, connected: sockets.size }));
    return;
  }
  void handle(req, res);
});
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', ws => {
  ws.on('message', raw => {
    const [joinRef, ref, topic, event] = JSON.parse(raw.toString());
    if (event === 'phx_join') sockets.set(ws, topic);
    ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
  });
  ws.on('close', () => sockets.delete(ws));
});
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/realtime/v1/websocket')) wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  else void upgrade(req, socket, head);
});
server.listen(port, '127.0.0.1', () => console.log(`Banner fixture: http://127.0.0.1:${port}`));
