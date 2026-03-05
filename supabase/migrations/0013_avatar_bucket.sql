-- Avatar bucket + policies (client-side uploads)

-- Ensure bucket exists and is public for reads
insert into storage.buckets (id, name, public)
values ('avatar', 'avatar', true)
on conflict (id) do update set public = excluded.public;

-- RLS policies for avatar uploads: users can only manage their own files
alter table storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can read avatars'
  ) then
    create policy "Public can read avatars"
      on storage.objects
      for select
      using (bucket_id = 'avatar');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload their avatar'
  ) then
    create policy "Users can upload their avatar"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'avatar'
        and name like ('users/' || auth.uid()::text || '/%')
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update their avatar'
  ) then
    create policy "Users can update their avatar"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'avatar'
        and name like ('users/' || auth.uid()::text || '/%')
      )
      with check (
        bucket_id = 'avatar'
        and name like ('users/' || auth.uid()::text || '/%')
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their avatar'
  ) then
    create policy "Users can delete their avatar"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'avatar'
        and name like ('users/' || auth.uid()::text || '/%')
      );
  end if;
end $$;

