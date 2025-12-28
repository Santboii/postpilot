-- Add timezone to profiles
alter table profiles 
add column if not exists timezone text default 'UTC';
