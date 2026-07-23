-- RLS for the AI Analysis Module: reference_profiles (readable by all authenticated users),
-- uploads (a player manages their own; a coach can view their team's), analysis_results (visible
-- to the uploader and their coach), and a public storage bucket for drill videos.
-- Uses my_team_id()/my_role() from 0005_roster_drills_assignments_rls.sql.

alter table reference_profiles enable row level security;

create policy "Authenticated users can read reference profiles" on reference_profiles
  for select
  using (auth.role() = 'authenticated');

alter table uploads enable row level security;

create policy "Players can insert their own uploads" on uploads
  for insert
  with check (player_id = auth.uid());

create policy "Relevant users can view uploads" on uploads
  for select
  using (
    player_id = auth.uid()
    or (my_role() = 'coach' and exists (select 1 from users u where u.id = player_id and u.team_id = my_team_id()))
  );

alter table analysis_results enable row level security;

create policy "Players can insert analysis for their own uploads" on analysis_results
  for insert
  with check (
    exists (select 1 from uploads up where up.id = upload_id and up.player_id = auth.uid())
  );

create policy "Relevant users can view analysis results" on analysis_results
  for select
  using (
    exists (
      select 1 from uploads up
      where up.id = upload_id
      and (
        up.player_id = auth.uid()
        or (my_role() = 'coach' and exists (select 1 from users u where u.id = up.player_id and u.team_id = my_team_id()))
      )
    )
  );

-- Storage bucket for drill videos. Public read (via public URL) keeps playback simple for this
-- scaffold stage; writes are still gated so only the authenticated owner can upload to their
-- own folder (path convention: `<player_id>/<filename>`).
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload their own videos" on storage.objects
  for insert
  with check (
    bucket_id = 'uploads'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
