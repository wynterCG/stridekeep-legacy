-- Stridekeep MVB · 0007_dev_set_team
-- DEV-ONLY: lets a bot reassign its own team after signup. Required for
-- the bot runner's "50 red + 50 blue" mode (the handle_new_user trigger
-- only does random 50/50 assignment, so without this we can't guarantee
-- balanced bot populations).
--
-- ⚠ REMOVE before public beta — real users must NEVER be able to switch
-- teams (SKILL.md §9: team is "assigned once on signup, immutable"). The
-- function is grant-execute to authenticated for now because there's no
-- separate dev role; real-user enforcement should layer on top later.

create or replace function public.dev_set_my_team(p_team text)
returns text
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
  if p_team not in ('red', 'blue') then
    raise exception 'team must be red or blue';
  end if;

  update public.users set team = p_team where id = v_uid;
  return p_team;
end;
$$;

grant execute on function public.dev_set_my_team(text) to authenticated;
