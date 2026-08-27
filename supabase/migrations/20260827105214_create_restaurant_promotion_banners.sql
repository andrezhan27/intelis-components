create table public.restaurant_promotions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null
    references public.restaurants(id) on delete cascade,
  enabled boolean not null default false,
  message text not null,
  link_url text,
  link_text text,
  starts_at timestamptz,
  ends_at timestamptz,
  dismissible boolean not null default false,
  variant text not null default 'default',
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurant_promotions_message_length
    check (length(trim(message)) between 1 and 280),
  constraint restaurant_promotions_link_url_length
    check (link_url is null or length(link_url) between 1 and 2048),
  constraint restaurant_promotions_link_url_safe
    check (
      link_url is null
      or (
        link_url = trim(link_url)
        and link_url !~ '[[:space:][:cntrl:]]'
        and (
          (left(link_url, 1) = '/' and left(link_url, 2) <> '//')
          or link_url ~ '^https://[^/?#[:space:]]+([/?#][^[:space:]]*)?$'
        )
      )
    ),
  constraint restaurant_promotions_link_text_length
    check (link_text is null or length(trim(link_text)) between 1 and 80),
  constraint restaurant_promotions_link_text_requires_url
    check (link_text is null or link_url is not null),
  constraint restaurant_promotions_valid_schedule
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint restaurant_promotions_variant
    check (variant in ('default', 'announcement', 'promotion', 'urgent')),
  constraint restaurant_promotions_priority
    check (priority between -1000 and 1000)
);

comment on table public.restaurant_promotions is
  'Native website announcement banners. Rows are retained for history and scheduling; websites render the highest-ranked active row.';
comment on column public.restaurant_promotions.ends_at is
  'Exclusive end of the promotion display window.';
comment on column public.restaurant_promotions.link_url is
  'Optional root-relative path or absolute HTTPS URL; unsafe protocols are rejected.';
comment on column public.restaurant_promotions.priority is
  'Higher values win when multiple promotions are eligible.';

create index restaurant_promotions_active_lookup
on public.restaurant_promotions (
  restaurant_id,
  priority desc,
  starts_at desc nulls last,
  created_at desc
)
where enabled;

create trigger restaurant_promotions_set_updated_at
before update on public.restaurant_promotions
for each row execute function private.set_updated_at();

alter table public.restaurant_promotions enable row level security;

revoke all on table public.restaurant_promotions from anon, authenticated;
grant select, insert, update, delete
  on table public.restaurant_promotions to authenticated;
grant all on table public.restaurant_promotions to service_role;

create policy "restaurant admins read promotions"
on public.restaurant_promotions for select to authenticated
using ((select private.has_restaurant_role(
  restaurant_promotions.restaurant_id,
  array['owner', 'manager']::text[]
)));

create policy "restaurant admins insert promotions"
on public.restaurant_promotions for insert to authenticated
with check ((select private.has_restaurant_role(
  restaurant_promotions.restaurant_id,
  array['owner', 'manager']::text[]
)));

create policy "restaurant admins update promotions"
on public.restaurant_promotions for update to authenticated
using ((select private.has_restaurant_role(
  restaurant_promotions.restaurant_id,
  array['owner', 'manager']::text[]
)))
with check ((select private.has_restaurant_role(
  restaurant_promotions.restaurant_id,
  array['owner', 'manager']::text[]
)));

create policy "restaurant admins delete promotions"
on public.restaurant_promotions for delete to authenticated
using ((select private.has_restaurant_role(
  restaurant_promotions.restaurant_id,
  array['owner', 'manager']::text[]
)));

create function public.get_active_restaurant_promotion(p_restaurant_id text)
returns table (
  id uuid,
  message text,
  link_url text,
  link_text text,
  dismissible boolean,
  variant text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    promotion.id,
    promotion.message,
    promotion.link_url,
    promotion.link_text,
    promotion.dismissible,
    promotion.variant
  from public.restaurant_promotions as promotion
  inner join public.restaurants as restaurant
    on restaurant.id = promotion.restaurant_id
  where promotion.restaurant_id = p_restaurant_id
    and restaurant.active is true
    and promotion.enabled is true
    and (promotion.starts_at is null or promotion.starts_at <= now())
    and (promotion.ends_at is null or promotion.ends_at > now())
  order by
    promotion.priority desc,
    promotion.starts_at desc nulls last,
    promotion.created_at desc,
    promotion.id desc
  limit 1;
$$;

comment on function public.get_active_restaurant_promotion(text) is
  'Public read-only API for the single active native website promotion. Returns only fields required for rendering.';

revoke all on function public.get_active_restaurant_promotion(text)
  from public, anon, authenticated;
grant execute on function public.get_active_restaurant_promotion(text)
  to anon, authenticated, service_role;
