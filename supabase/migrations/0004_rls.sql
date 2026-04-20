-- Stridekeep MVB · 0004_rls
-- Lock down both tables. Writes happen only via the SECURITY DEFINER RPC.

alter table public.users enable row level security;
alter table public.teams enable row level security;

-- users: each player can read their own row only.
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (auth.uid() = id);

-- teams: any authenticated user can read both team totals (so you see the rival).
drop policy if exists teams_select_all on public.teams;
create policy teams_select_all on public.teams
  for select using (auth.role() = 'authenticated');

-- No insert/update/delete policies on either table → all direct writes blocked.
-- The deposit_for_town RPC bypasses RLS via SECURITY DEFINER.
