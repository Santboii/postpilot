-- Create the storage bucket "post-media"
insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket
-- Allow public read access
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'post-media' );

-- Allow authenticated users to upload images
create policy "Authenticated users can upload images"
on storage.objects for insert
with check (
  bucket_id = 'post-media'
  and auth.role() = 'authenticated'
);

-- Allow users to update/delete their own uploads (optional, good practice)
create policy "Users can update own images"
on storage.objects for update
using (
  bucket_id = 'post-media'
  and auth.uid() = owner
);

create policy "Users can delete own images"
on storage.objects for delete
using (
  bucket_id = 'post-media'
  and auth.uid() = owner
);
