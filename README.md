# @intelis/restaurant-ui

Shared native React/Next.js UI for Intelis restaurant websites. The promotion
banner calls the narrow Supabase `get_active_restaurant_promotion` RPC on the
server without caching, renders nothing on failure, and only hydrates the
dismissible interaction. Promotion changes are visible on the next website
request or navigation.

## Restaurant website

Install this package and ensure the website has
`NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the
legacy anon key). Then add the banner near the top of the root layout:

```tsx
import { PromotionBanner } from "@intelis/restaurant-ui";

<body>
  <PromotionBanner restaurantId={restaurantId} />
  <Header />
  {children}
</body>
```

The component uses these optional brand variables:

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

```tsx
import { PromotionManager } from "@intelis/restaurant-ui/dashboard";

<PromotionManager supabase={supabase} restaurantId={restaurantId} />
```

Saving is reflected on the next website request or navigation. Consumers may
pass `onSaved` to run deployment-specific follow-up work.
