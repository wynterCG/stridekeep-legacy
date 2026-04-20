-- Stridekeep MVB · 0003_deposit_rpc
-- Server-authoritative deposit. Caller's team is looked up via auth.uid();
-- amount is added atomically to the team's running total.

-- Drop a prior integer-signature version if it exists (signature changed
-- bigint upgrade). Safe no-op if it was never created.
drop function if exists public.deposit_for_town(integer);

create or replace function public.deposit_for_town(p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_team  text;
  v_total bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Cap a single deposit. No legitimate purse should ever come close to this;
  -- guard exists so a future bug or malicious client can't pump in 9.2e18 in
  -- one shot. Comfortably above the largest reachable single-purse value.
  if p_amount > 1000000000 then
    raise exception 'amount too large';
  end if;

  select team into v_team from public.users where id = v_uid;
  if v_team is null then
    raise exception 'no team for user';
  end if;

  update public.teams
    set total      = total + p_amount,
        updated_at = now()
    where color = v_team
    returning total into v_total;

  return v_total;
end;
$$;

revoke all on function public.deposit_for_town(bigint) from public;
grant execute on function public.deposit_for_town(bigint) to authenticated;
