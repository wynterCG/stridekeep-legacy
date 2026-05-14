-- Stridekeep · 0020_delete_my_account
--
-- Self-serve account deletion. Required by Google Play's 2024 policy
-- ("if your app allows users to create an account, it must also allow
-- them to delete it from within the app"). Same path as the privacy
-- policy promise: a logged-in user taps DELETE MY ACCOUNT and all
-- personal data tied to their auth UUID is removed.
--
-- Cascade chain (already wired by earlier migrations):
--   auth.users delete
--     → public.users          (0001: on delete cascade)
--     → public.user_badges    (0011: on delete cascade)
--     → public.canvas_pixels  (0009: placed_by set null — pixels stay,
--                              attribution drops)
--
-- public.feed_events is NOT touched here: the table self-trims to 100
-- rows via the 0012 trigger, so any deleted user's events naturally
-- evaporate within hours of any subsequent game activity. The
-- denormalized `nickname` column is the only thing that could
-- theoretically link a feed row back to a person, and once auth.users
-- is gone there's no joinable identifier left — the nickname becomes
-- an orphan string. Scrubbing it actively would risk hitting OTHER
-- users who happen to share the same nickname (custom names aren't
-- unique), so we let the self-trim handle it.
--
-- Side-channel concerns:
-- - public.seasons, public.teams, public.teams_canvas_progress are
--   global aggregates — never user-keyed.
-- - public.season_colors / season_craft_recipes / canvas_milestones —
--   schema metadata, no per-user rows.
-- The delete is therefore complete with the single auth.users delete.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- The single source of truth. All public.* rows cascade off this
  -- delete via FKs declared in 0001 / 0009 / 0011. Function runs as
  -- the postgres role (SECURITY DEFINER), which has DELETE privilege
  -- on auth.users — the calling authenticated role does NOT.
  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
