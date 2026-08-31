-- Integration test: run as the database owner; ALL fixtures and events roll back.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
do $$
declare
  restaurant text;
  first_id uuid;
  second_id uuid;
  future_id uuid;
  result jsonb;
  ordered uuid[];
begin
  select id into restaurant from public.restaurants where active is true limit 1;
  if restaurant is null then raise exception 'Test needs one active restaurant'; end if;
  perform set_config('test.promotion_restaurant', restaurant, true);
  insert into public.restaurant_promotions(restaurant_id, enabled, message, priority)
    values (restaurant, true, 'Rotation test first', 900) returning id into first_id;
  insert into public.restaurant_promotions(restaurant_id, enabled, message, priority)
    values (restaurant, true, 'Rotation test second', 800) returning id into second_id;
  insert into public.restaurant_promotions(restaurant_id, enabled, message, starts_at)
    values (restaurant, true, 'Future content must stay private', now() + interval '1 hour') returning id into future_id;
  insert into public.restaurant_promotions(restaurant_id, enabled, message)
    values (restaurant, false, 'Disabled content must stay private');
  insert into public.restaurant_promotions(restaurant_id, enabled, message, ends_at)
    values (restaurant, true, 'Expired content must stay private', now());
  result := public.get_restaurant_promotion_state(restaurant);
  select array_agg((v->>'id')::uuid order by position) into ordered
    from jsonb_array_elements(result->'promotions') with ordinality as t(v, position)
    where (v->>'id')::uuid in (first_id, second_id);
  assert ordered = array[first_id, second_id], 'Priority order failed';
  assert result::text not like '%must stay private%', 'Ineligible content leaked';
  assert (result->>'next_change_at')::timestamptz <= now() + interval '1 hour', 'Schedule boundary missing';
  assert (select count(*) = 1 from public.get_active_restaurant_promotion(restaurant)), 'Legacy API changed';
  assert not has_table_privilege('anon', 'public.restaurant_promotions', 'SELECT'), 'Anonymous table access was opened';
  assert not has_function_privilege('anon', 'private.notify_restaurant_promotions_changed()', 'EXECUTE'), 'Trigger can be called by anon';
  assert not has_function_privilege('authenticated', 'private.notify_restaurant_promotions_changed()', 'EXECUTE'), 'Trigger can be called by authenticated';
  update public.restaurant_promotions set enabled = false where id = first_id;
  result := public.get_restaurant_promotion_state(restaurant);
  assert not exists(select 1 from jsonb_array_elements(result->'promotions') v where v->>'id' = first_id::text), 'Disabled banner remains';
  delete from public.restaurant_promotions where id = second_id;
  result := public.get_restaurant_promotion_state(restaurant);
  assert not exists(select 1 from jsonb_array_elements(result->'promotions') v where v->>'id' = second_id::text), 'Deleted banner remains';
  update public.restaurants set active = false where id = restaurant;
  result := public.get_restaurant_promotion_state(restaurant);
  assert result->'promotions' = '[]'::jsonb, 'Inactive restaurant exposed banners';
  assert result->'next_change_at' = 'null'::jsonb, 'Inactive schedule exposed';
end;
$$;
set local role anon;
do $$
begin
  assert public.get_restaurant_promotion_state('__nonexistent_banner_test__')->'promotions' = '[]'::jsonb;
  assert public.get_restaurant_promotion_state(current_setting('test.promotion_restaurant'))->'promotions' = '[]'::jsonb;
end;
$$;
reset role;
rollback;
select 'Passed: ordering, eligibility, scheduling, legacy API, removals, inactive restaurant and anonymous permissions; fixtures rolled back.' as result;
