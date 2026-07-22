-- Core schema for the Hoops Coaching PWA (v1)
-- RLS policies are deferred (TODO) — not blocking for scaffold-only scope.

create extension if not exists "pgcrypto";

create table teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('coach', 'player')),
  name text not null,
  team_id uuid references teams (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table teams
  add constraint teams_coach_id_fkey foreign key (coach_id) references users (id) on delete cascade;

create table drills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  skill_category text not null check (skill_category in ('shooting', 'ballhandling', 'defense', 'passing', 'conditioning')),
  reference_video_url text,
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  drill_id uuid not null references drills (id) on delete cascade,
  team_id uuid references teams (id) on delete cascade,
  player_id uuid references users (id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  check (team_id is not null or player_id is not null)
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references users (id) on delete cascade,
  drill_id uuid not null references drills (id) on delete cascade,
  video_url text not null,
  created_at timestamptz not null default now()
);

create table reference_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('player', 'position')),
  signature_moves jsonb not null default '[]',
  key_stats jsonb not null default '{}',
  summary text not null
);

create table analysis_results (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads (id) on delete cascade,
  reference_player_or_position text not null,
  feedback_text text not null,
  structured_feedback jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references users (id) on delete cascade,
  metric_name text not null,
  value numeric not null,
  updated_at timestamptz not null default now()
);
