-- Stridekeep · 0016_phase4_realtime (Phase-4 Mosaic Edition · Step 5 / S5.A finishing touch)
--
-- Adds canvas_pixels, seasons, user_badges to the supabase_realtime publication
-- so the React Native client can subscribe to row-level changes (tile placements,
-- season rollover, badge awards). Each `alter publication ... add table` errors
-- with 42710/duplicate_object if the table is already a member, so wrap each in
-- a do/exception block to keep the migration idempotent on re-run.
--
-- teams was added to supabase_realtime via the Phase-3 dashboard runbook and is
-- not re-added here. deposits was dropped in 0012 and Postgres auto-removes
-- dropped tables from publications.

do $$
begin
  alter publication supabase_realtime add table public.canvas_pixels;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.seasons;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_badges;
exception
  when duplicate_object then null;
end $$;
