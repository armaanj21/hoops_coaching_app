-- Helper functions (security definer, so they bypass RLS on `users` internally and avoid
-- recursive policy evaluation) used by the policies below.

create function my_team_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select team_id from users where id = auth.uid()
$$;

create function my_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid()
$$;

-- Coaches need to see their players; players need to see their teammates (for future
-- team-wide features). `users` already has an own-row policy from 0004.
create policy "Users can select teammates" on users
  for select
  using (team_id is not null and team_id = my_team_id());

-- Drill library is readable by any authenticated user.
alter table drills enable row level security;

create policy "Authenticated users can read drills" on drills
  for select
  using (auth.role() = 'authenticated');

-- Assignments: a coach can assign a drill to their own team or to a player on their team;
-- a player can see assignments made to them directly or to their whole team.
alter table assignments enable row level security;

create policy "Coaches can insert assignments for their team" on assignments
  for insert
  with check (
    my_role() = 'coach'
    and (
      (team_id is not null and team_id = my_team_id())
      or (player_id is not null and exists (
        select 1 from users u where u.id = player_id and u.team_id = my_team_id()
      ))
    )
  );

create policy "Team members can view relevant assignments" on assignments
  for select
  using (
    player_id = auth.uid()
    or (team_id is not null and team_id = my_team_id())
    or (
      my_role() = 'coach'
      and player_id is not null
      and exists (select 1 from users u where u.id = player_id and u.team_id = my_team_id())
    )
  );
