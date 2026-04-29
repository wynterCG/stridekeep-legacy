-- Stridekeep · 0011a_murals_storage (Phase-4 Mosaic Edition · Step 5 / S5.A)
--
-- Public-read storage bucket for mural PNGs. The Godot mural-prep tool
-- uploads each season's quantized 32×32 PNG to a deterministic path
--   murals/season_{N}.png
-- and the client derives badge image URLs from this same path:
--   ${SUPABASE_URL}/storage/v1/object/public/murals/season_${N}.png
--
-- public=true on the bucket means SELECT requires no auth — badges in a
-- player's gallery render from a plain <Image source={{uri:…}} /> without
-- a signed-URL round-trip.
--
-- Writes (INSERT / UPDATE / DELETE) are restricted to service_role ONLY.
-- service_role bypasses RLS, so we just don't create any write policies —
-- the absence of an `authenticated` policy means signed-in players cannot
-- write. Originally a permissive `to authenticated with check ...` was
-- planned, but Stridekeep's app calls signInAnonymously() so every player
-- has the `authenticated` role, and the anon key is shipped in the React
-- Native bundle. Permissive auth-write policies would let any user
-- decompile the APK, sign in anonymously, and overwrite mural PNGs in
-- everyone else's badge galleries. service_role-only closes that gap.
--
-- Operational implication: the Godot mural-prep tool must use the
-- service_role key (NOT the anon key) for its mural upload step. Load
-- the service_role from a local .env file in tools/mural-prep-godot/
-- — never bundle it into the React Native app or commit it.
--
-- Plan §371-374.

-- The Supabase SQL editor runs as the postgres / supabase_admin role,
-- which bypasses storage.buckets RLS — running this from a less-
-- privileged role would error with "permission denied for table buckets."
insert into storage.buckets (id, name, public)
  values ('murals', 'murals', true)
  on conflict (id) do update
    set public = true, name = excluded.name;

-- ─── Policies on storage.objects ──────────────────────────────────────────
-- Storage policies in Supabase apply to the storage.objects table. Bucket
-- isolation is via `bucket_id = 'murals'`.
--
-- Only the public-read SELECT policy. Writes are service_role only (the
-- absence of an INSERT / UPDATE / DELETE policy means no role except
-- service_role — which bypasses RLS — can write to the murals bucket).

drop policy if exists murals_public_select on storage.objects;
create policy murals_public_select on storage.objects
  for select using (bucket_id = 'murals');

-- Defensive cleanup: if a prior version of this migration created the
-- now-removed authenticated-write policies, drop them on re-apply.
drop policy if exists murals_authenticated_insert on storage.objects;
drop policy if exists murals_authenticated_update on storage.objects;
