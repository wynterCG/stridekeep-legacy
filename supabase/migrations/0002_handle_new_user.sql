-- Stridekeep MVB · 0002_handle_new_user
-- Trigger: on every new auth.users row, assign a random team and insert into public.users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, team)
  values (
    new.id,
    case when random() < 0.5 then 'red' else 'blue' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
