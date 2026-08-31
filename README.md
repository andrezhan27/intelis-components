# @andrezhan27/intelis-restaurant-ui

Shared native React/Next.js UI for Intelis restaurant websites and dashboards.

## Restaurant website

Install this package and its peers (`react`, `next`, and `@supabase/supabase-js`).
Supabase is now required for the live banner, not just for the dashboard.
Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key), then add:

```tsx
import { PromotionBanner } from "@andrezhan27/intelis-restaurant-ui";

<body>
  <PromotionBanner restaurantId={restaurantId} />
  <Header />
  {children}
</body>
```

The server renders an initial snapshot and the browser subscribes to live
changes, including when there are initially no banners. Only a publishable or
legacy `anon` key may be passed to the client. Secret/service-role keys are
rejected. `rotationIntervalMs` defaults to `5000`; values below `3000` are clamped.

### Rotation and dismissal

- Active means the restaurant is active, the promotion is enabled, its start
  has arrived (or is unset), and its exclusive end has not arrived (or is unset).
- Database order: priority descending, start descending (unset last), creation
  descending, then ID descending. Ordinary banners get equal time, in order.
- The highest-ranked undismissed `urgent` banner stays visible without rotation.
  Dismiss, disable, delete, or expire it to reveal the next urgent/regular banner.
- Message, link text, and destination transition together over 420ms. The banner's
  color variant stays fixed for the component's lifetime.
  Stacked slides reserve room for the longest message to prevent rotation jumps.
- Closing a dismissible banner removes only that promotion and shows the next.
  IDs are stored in `sessionStorage`, scoped to the restaurant. Dismissal survives
  reload/navigation in that tab and normally ends when the tab is closed. New
  independent tabs start fresh; browsers may restore storage when restoring tabs.
  If storage is blocked, dismissal still works until the page reloads.
- Editing an already dismissed promotion does not make it reappear in that
  session. Turning off its `dismissible` flag makes it visible again.
- Multiple banners have previous/next, pause/resume, and a position indicator.
  Rotation pauses during hover, keyboard focus, and while the page is hidden.
  Manual navigation pauses rotation. Reduced-motion users navigate manually
  without animated transitions. One banner has no rotation controls.

### Live changes and scheduling

`get_restaurant_promotion_state` is a narrow public RPC returning ordered active
banners, server time, and the next scheduled change. It uses `cache: "no-store"`.
Database triggers broadcast invalidations on
`restaurant-promotions:<restaurantId>` for promotion insert/update/delete and
restaurant activation/deactivation. Payloads contain no promotion content
(Supabase adds a delivery ID). Visitors refetch the authoritative public RPC;
public messages cannot inject banner text or links.

Changes appear as soon as the push notification and refresh arrive, subject to
normal network latency. Scheduled starts trigger a refresh at the returned
boundary. Known endings are removed locally at their deadline even if offline.
Reconnect, visibility return, and online events refresh the data. A 30-second
safety check catches missed notifications; failed requests retry with backoff
from one to 30 seconds. During an outage, retain the last known unexpired data.
Instant remote updates cannot be guaranteed while a visitor is offline.

The RPC's deliberate `SECURITY DEFINER` boundary preserves existing restrictions:
anonymous users cannot read the admin table, and draft/future/expired content is
not returned. RLS for restaurant administrators remains unchanged. Supabase's
[public executable function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
flags this intentional public API (as it does the legacy single-banner API).
Trigger functions are private and are not executable by anonymous/authenticated
clients. Public topics disclose change timing, never unpublished row contents.

### Styling

Override these brand variables to keep a site's own colors:

```css
:root {
  --promotion-banner-bg: #171717;
  --promotion-banner-text: #ffffff;
  --promotion-banner-link: #f1d48a;
  --promotion-banner-border: transparent;
}
```

## Dashboard

The dashboard entry uses the existing authenticated Supabase client. RLS limits
reads and writes to owner/manager memberships for the selected restaurant.
The list is ordered by display priority and shows each promotion's priority.

```tsx
import { PromotionManager } from "@andrezhan27/intelis-restaurant-ui/dashboard";

<PromotionManager supabase={supabase} restaurantId={restaurantId} />
```

Saving updates connected websites through the database trigger; `onSaved` remains
available for deployment-specific follow-up work.

## Rollout and verification

Apply `supabase/migrations/20260831163015_rotate_live_restaurant_promotions.sql`
before upgrading the UI. It has been applied to the connected Supabase project.
The original `get_active_restaurant_promotion` RPC and `fetchActivePromotion`
export remain unchanged for older consumers. Websites only gain rotation/live
updates after installing a release containing these changes and redeploying.
This repository does not deploy those consumer websites automatically.

- `npm test`: build plus data-contract, URL, ordering, urgency, expiry, and key-safety tests.
- `npm run check`: TypeScript verification.
- `tests/promotion-database.sql`: database-owner integration test; fixtures and
  broadcasts roll back. Needs an existing active restaurant.
- `npm run preview:banners`: local browser fixture at `http://127.0.0.1:3111`.
  Uses the actual component and Supabase client against a local mock RPC and
  Broadcast server. Controls exercise live edits, removals, urgent notices,
  schedules, and outages without touching restaurant data.
- `tests/realtime-probe.mjs`: optional real-project public API/Broadcast probe;
  see its usage comments. Never provide a service-role key.
