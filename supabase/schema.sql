-- PostPilot Database Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/zbkihyrbxsgzdeheuxrb/sql

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content text not null,
  status text check (status in ('draft', 'scheduled', 'published', 'failed')) default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Post platform assignments
create table if not exists post_platforms (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade not null,
  platform text not null,
  custom_content text,
  created_at timestamptz default now()
);

-- Connected social accounts
create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  platform text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  platform_user_id text,
  platform_username text,
  created_at timestamptz default now()
);

-- Activity feed
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text not null,
  message text not null,
  post_id uuid references posts on delete set null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table posts enable row level security;
alter table post_platforms enable row level security;
alter table connected_accounts enable row level security;
alter table activities enable row level security;
alter table profiles enable row level security;

-- Drop existing policies if they exist (for re-running)
drop policy if exists "Users can CRUD own posts" on posts;
drop policy if exists "Users can CRUD own post_platforms" on post_platforms;
drop policy if exists "Users can CRUD own connected_accounts" on connected_accounts;
drop policy if exists "Users can CRUD own activities" on activities;
drop policy if exists "Users can CRUD own profile" on profiles;

-- Create policies
create policy "Users can CRUD own posts" on posts
  for all using (auth.uid() = user_id);

create policy "Users can CRUD own post_platforms" on post_platforms
  for all using (post_id in (select id from posts where user_id = auth.uid()));

create policy "Users can CRUD own connected_accounts" on connected_accounts
  for all using (auth.uid() = user_id);

create policy "Users can CRUD own activities" on activities
  for all using (auth.uid() = user_id);

create policy "Users can CRUD own profile" on profiles
  for all using (auth.uid() = id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes for performance
create index if not exists idx_posts_user_id on posts(user_id);
create index if not exists idx_posts_status on posts(status);
create index if not exists idx_posts_scheduled_at on posts(scheduled_at);
create index if not exists idx_post_platforms_post_id on post_platforms(post_id);
create index if not exists idx_activities_user_id on activities(user_id);
