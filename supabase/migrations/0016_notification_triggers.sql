-- ============================================================================
-- Migration: Notification triggers for project actions
-- Creates automatic notifications when:
--   - A document is uploaded to a project
--   - A member is added to a project
--   - A message is sent in a project chat
-- ============================================================================

begin;

-- 1) Add metadata column to notifications for rich content (avatar, preview, etc.)
alter table public.notifications
  add column if not exists metadata jsonb;

-- ============================================================================
-- TRIGGER: Document uploaded → notify all project members
-- ============================================================================
create or replace function public.notify_document_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uploader_name text;
  uploader_avatar text;
  project_name text;
  member_record record;
begin
  if NEW.project_id is null then return NEW; end if;

  select full_name, avatar_url into uploader_name, uploader_avatar
    from public.profiles where id = NEW.uploaded_by;

  select name into project_name
    from public.projects where id = NEW.project_id;

  for member_record in
    select distinct user_id from public.project_members
    where project_id = NEW.project_id
      and user_id != NEW.uploaded_by
      and lower(btrim(coalesce(status, ''))) in ('accepted', 'active')
  loop
    insert into public.notifications (user_id, title, description, type, action_url, metadata)
    values (
      member_record.user_id,
      coalesce(uploader_name, 'Quelqu''un') || ' a publié un document',
      '"' || NEW.name || '" dans ' || coalesce(project_name, 'un projet'),
      'document',
      '/dashboard/projets/' || NEW.project_id::text || '?tab=documents',
      jsonb_build_object(
        'actor_name',    coalesce(uploader_name, 'Inconnu'),
        'actor_avatar',  uploader_avatar,
        'project_name',  coalesce(project_name, ''),
        'project_id',    NEW.project_id::text,
        'document_name', NEW.name
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_document_upload on public.documents;
create trigger trg_notify_document_upload
  after insert on public.documents
  for each row execute function public.notify_document_upload();

-- ============================================================================
-- TRIGGER: Member added → notify existing members with manager role
-- ============================================================================
create or replace function public.notify_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_member_name text;
  new_member_avatar text;
  project_name text;
  member_record record;
begin
  if NEW.user_id is null then return NEW; end if;

  select full_name, avatar_url into new_member_name, new_member_avatar
    from public.profiles where id = NEW.user_id;

  select name into project_name
    from public.projects where id = NEW.project_id;

  for member_record in
    select distinct user_id from public.project_members
    where project_id = NEW.project_id
      and user_id != NEW.user_id
      and lower(btrim(coalesce(status, ''))) in ('accepted', 'active')
  loop
    insert into public.notifications (user_id, title, description, type, action_url, metadata)
    values (
      member_record.user_id,
      coalesce(new_member_name, 'Un nouveau membre') || ' a rejoint le projet',
      coalesce(project_name, 'Votre projet'),
      'member',
      '/dashboard/projets/' || NEW.project_id::text || '?tab=membres',
      jsonb_build_object(
        'actor_name',   coalesce(new_member_name, 'Inconnu'),
        'actor_avatar', new_member_avatar,
        'project_name', coalesce(project_name, ''),
        'project_id',   NEW.project_id::text
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_member_added on public.project_members;
create trigger trg_notify_member_added
  after insert on public.project_members
  for each row execute function public.notify_member_added();

-- ============================================================================
-- TRIGGER: Message sent → notify all project members with sender info + preview
-- ============================================================================
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  sender_avatar text;
  project_name text;
  preview text;
  member_record record;
begin
  if NEW.project_id is null then return NEW; end if;

  select full_name, avatar_url into sender_name, sender_avatar
    from public.profiles where id = NEW.author_id;

  select name into project_name
    from public.projects where id = NEW.project_id;

  -- Message preview: first 100 chars
  preview := left(NEW.content, 100);
  if length(NEW.content) > 100 then preview := preview || '…'; end if;

  for member_record in
    select distinct user_id from public.project_members
    where project_id = NEW.project_id
      and user_id != NEW.author_id
      and lower(btrim(coalesce(status, ''))) in ('accepted', 'active')
  loop
    insert into public.notifications (user_id, title, description, type, action_url, metadata)
    values (
      member_record.user_id,
      coalesce(sender_name, 'Quelqu''un'),
      preview,
      'message',
      '/dashboard/projets/' || NEW.project_id::text || '?tab=chat',
      jsonb_build_object(
        'actor_name',      coalesce(sender_name, 'Inconnu'),
        'actor_avatar',    sender_avatar,
        'project_name',    coalesce(project_name, ''),
        'project_id',      NEW.project_id::text,
        'message_preview', preview,
        'is_group',        true
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

commit;
