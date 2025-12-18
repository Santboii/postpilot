create table if not exists brand_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  brand_name text not null,
  audience text not null,
  tone text not null,
  examples text[] default array[]::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table brand_profiles enable row level security;

create policy "Users can view their own brand profile"
  on brand_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own brand profile"
  on brand_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own brand profile"
  on brand_profiles for update
  using (auth.uid() = user_id);
