-- Bucket público para imágenes y videos de trabajos científicos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  104857600, -- 100 MB
  array[
    'image/jpeg','image/jpg','image/png','image/gif','image/webp',
    'video/mp4','video/webm','video/ogg','video/quicktime'
  ]
);

create policy "Public read" on storage.objects
  for select using (bucket_id = 'media');

create policy "Allow upload" on storage.objects
  for insert with check (bucket_id = 'media');

create policy "Allow delete" on storage.objects
  for delete using (bucket_id = 'media');
