-- migration: create triggers to insert notifications for follows, likes and comments

-- Follow notification
create or replace function notify_on_follow() returns trigger as $$
begin
  -- Insert a notification for the user being followed
  insert into notifications (user_id, title, description, type, from_user_id, created_at, is_read)
  values (NEW.following_id, 'Novo seguidor', null, 'follow', NEW.follower_id, now(), false);
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_follow on follows;
create trigger trg_notify_on_follow
  after insert on follows
  for each row execute function notify_on_follow();

-- Like notification
create or replace function notify_on_like() returns trigger as $$
declare
  owner uuid;
begin
  select user_id into owner from publications where id = NEW.publication_id;
  if owner is null then
    return NEW;
  end if;
  -- avoid notifying the owner if they liked their own post
  if owner = NEW.user_id then
    return NEW;
  end if;
  insert into notifications (user_id, title, description, type, from_user_id, publication_id, created_at, is_read)
  values (owner, 'Curtida no seu áudio', null, 'like', NEW.user_id, NEW.publication_id, now(), false);
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_like on likes;
create trigger trg_notify_on_like
  after insert on likes
  for each row execute function notify_on_like();

-- Comment notification
create or replace function notify_on_comment() returns trigger as $$
declare
  owner uuid;
  excerpt text;
begin
  select user_id into owner from publications where id = NEW.publication_id;
  if owner is null then
    return NEW;
  end if;
  if owner = NEW.user_id then
    return NEW;
  end if;
  excerpt := substring(NEW.content for 120);
  insert into notifications (user_id, title, description, type, from_user_id, publication_id, created_at, is_read)
  values (owner, 'Comentaram no seu áudio', excerpt, 'comment', NEW.user_id, NEW.publication_id, now(), false);
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_comment on comments;
create trigger trg_notify_on_comment
  after insert on comments
  for each row when (NEW.is_deleted = false)
  execute function notify_on_comment();
