-- RLS was already enabled on `users`/`teams` in this project with no policies defined,
-- which blocked signup (client insert into `users` and `teams`). Add the minimal
-- policies needed for the current auth flow: a user can insert/select/update their own
-- row; a coach can insert/update their own team; any authenticated user can look up a
-- team by invite code (needed for the join-team flow, which doesn't know the team id
-- ahead of time). Broader policies for rosters, drills, uploads, etc. are still TODO.

alter table users enable row level security;

create policy "Users can insert own row" on users
  for insert
  with check (auth.uid() = id);

create policy "Users can select own row" on users
  for select
  using (auth.uid() = id);

create policy "Users can update own row" on users
  for update
  using (auth.uid() = id);

alter table teams enable row level security;

create policy "Coaches can insert own team" on teams
  for insert
  with check (auth.uid() = coach_id);

create policy "Authenticated users can look up teams" on teams
  for select
  using (auth.role() = 'authenticated');

create policy "Coaches can update own team" on teams
  for update
  using (auth.uid() = coach_id);
