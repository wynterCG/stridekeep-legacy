-- Stridekeep MVB · 0006_nicknames
-- Adds nicknames so the live feed can show "Maeve deposited $120 to Red"
-- instead of just "+$120 to Red". Denormalised onto deposits at write
-- time so reads are a plain SELECT.

alter table public.users
  add column if not exists nickname text;

-- Deterministic default for any pre-nickname rows so we never show NULL.
update public.users
  set nickname = 'Stridekeeper-' || substr(replace(id::text, '-', ''), 1, 6)
  where nickname is null;

alter table public.users
  alter column nickname set not null;

alter table public.deposits
  add column if not exists nickname text not null default 'unknown';

-- New users get the same Stridekeeper-XXXXXX default; the bot script (and
-- a future user-facing settings screen) can rename via set_my_nickname.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, team, nickname)
  values (
    new.id,
    case when random() < 0.5 then 'red' else 'blue' end,
    'Stridekeeper-' || substr(replace(new.id::text, '-', ''), 1, 6)
  );
  return new;
end;
$$;

-- Allow the caller to update their own nickname. Length-clamped + trimmed
-- to avoid pathological inputs. Profanity filter is a Phase-3-full task.
create or replace function public.set_my_nickname(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_clean     text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_clean := trim(coalesce(p_nickname, ''));
  if length(v_clean) < 3 or length(v_clean) > 20 then
    raise exception 'nickname must be 3-20 characters';
  end if;

  update public.users set nickname = v_clean where id = v_uid;
  return v_clean;
end;
$$;

grant execute on function public.set_my_nickname(text) to authenticated;

-- Re-create deposit_for_town to also denormalize the caller's nickname
-- onto the new deposits row. Same body as 0005 plus the lookup + insert
-- column.
create or replace function public.deposit_for_town(p_amount bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_team      text;
  v_nickname  text;
  v_total     bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_amount > 1000000000 then
    raise exception 'amount too large';
  end if;

  select team, nickname into v_team, v_nickname
    from public.users where id = v_uid;
  if v_team is null then
    raise exception 'no team for user';
  end if;

  update public.teams
    set total      = total + p_amount,
        updated_at = now()
    where color = v_team
    returning total into v_total;

  insert into public.deposits (team, amount, nickname)
    values (v_team, p_amount, coalesce(v_nickname, 'unknown'));

  delete from public.deposits
    where id not in (select id from public.deposits order by id desc limit 100);

  return v_total;
end;
$$;
