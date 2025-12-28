-- Add ai_settings to content_libraries
alter table content_libraries 
add column if not exists ai_settings jsonb default '{}'::jsonb;
