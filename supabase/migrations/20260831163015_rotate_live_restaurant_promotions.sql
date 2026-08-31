-- Keep the single-row RPC intact for websites running older package versions.
-- This deliberately public, narrow API reveals only currently displayable text.
-- SECURITY DEFINER is required because anonymous visitors cannot read the admin
-- table. Restaurant/enable/schedule filters below are the public access boundary.
create function public.get_restaurant_promotion_state(p_restaurant_id text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with eligible as materialized (
    select p.*
    from public.restaurant_promotions p
    join public.restaurants r on r.id = p.restaurant_id and r.active is true
    where p.restaurant_id = p_restaurant_id and p.enabled is true
      and (p.ends_at is null or p.ends_at > now())
  )
  select jsonb_build_object(
    'server_time', now(),
    'next_change_at', (
      select min(boundary) from eligible e
      cross join lateral (values (e.starts_at), (e.ends_at)) as t(boundary)
      where boundary > now()
    ),
    'promotions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'message', message, 'link_url', link_url,
        'link_text', link_text, 'dismissible', dismissible,
        'variant', variant, 'ends_at', ends_at
      ) order by priority desc, starts_at desc nulls last, created_at desc, id desc)
      from eligible where starts_at is null or starts_at <= now()
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_restaurant_promotion_state(text)
  from public, anon, authenticated;
grant execute on function public.get_restaurant_promotion_state(text)
  to anon, authenticated, service_role;
comment on function public.get_restaurant_promotion_state(text) is
  'Public ordered active banners and next schedule boundary; never returns draft or future banner content.';
comment on column public.restaurant_promotions.priority is
  'Higher values appear first. Rotating websites give each ordinary banner equal time; highest-ranked urgent banner stays visible.';

-- Broadcast invalidation only, never row contents (which may be unpublished).
-- Trigger-only privileges prevent visitors from calling these functions as RPCs.
create function private.notify_restaurant_promotions_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if TG_OP <> 'INSERT' then
    perform realtime.send('{}'::jsonb, 'promotions_changed',
      'restaurant-promotions:' || OLD.restaurant_id, false);
  end if;
  if TG_OP = 'INSERT' then
    perform realtime.send('{}'::jsonb, 'promotions_changed',
      'restaurant-promotions:' || NEW.restaurant_id, false);
  elsif TG_OP = 'UPDATE' and NEW.restaurant_id is distinct from OLD.restaurant_id then
    perform realtime.send('{}'::jsonb, 'promotions_changed',
      'restaurant-promotions:' || NEW.restaurant_id, false);
  end if;
  return null;
end;
$$;
revoke all on function private.notify_restaurant_promotions_changed()
  from public, anon, authenticated;
create trigger restaurant_promotions_notify_changed
after insert or update or delete on public.restaurant_promotions
for each row execute function private.notify_restaurant_promotions_changed();

create function private.notify_restaurant_banner_availability()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'promotions_changed',
    'restaurant-promotions:' || NEW.id, false);
  return null;
end;
$$;
revoke all on function private.notify_restaurant_banner_availability()
  from public, anon, authenticated;
create trigger restaurants_notify_banner_availability
after update of active on public.restaurants
for each row when (OLD.active is distinct from NEW.active)
execute function private.notify_restaurant_banner_availability();
