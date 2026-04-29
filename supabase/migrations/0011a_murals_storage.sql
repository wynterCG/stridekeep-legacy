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
-- a signed-URL round-trip. INSERT / UPDATE require an authenticated user
-- (the dev running the Godot tool with the anon key).
--
-- Plan §371-374.

insert into storage.buckets (id, name, public)
  values ('murals', 'murals', true)
  on conflict (id) do update
    set public = true, name = excluded.name;

-- ─── Policies on storage.objects ──────────────────────────────────────────
-- Storage policies in Supabase apply to the storage.objects table. Bucket
-- isolation is via `bucket_id = 'murals'`.

drop policy if exists murals_public_select on storage.objects;
create policy murals_public_select on storage.objects
  for select using (bucket_id = 'murals');

drop policy if exists murals_authenticated_insert on storage.objects;
create policy murals_authenticated_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'murals');

-- Update allowed so re-seeding the same season number replaces the file
-- (Godot tool's "regenerate this mural" workflow).
drop policy if exists murals_authenticated_update on storage.objects;
create policy murals_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'murals')
  with check (bucket_id = 'murals');
