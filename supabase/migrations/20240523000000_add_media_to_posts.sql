-- Add media column to posts table
alter table "public"."posts" add column "media" jsonb default '[]'::jsonb;

-- Comment on column
comment on column "public"."posts"."media" is 'Array of media attachments (images/videos)';
