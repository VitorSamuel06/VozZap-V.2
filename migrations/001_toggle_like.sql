-- migration: create trigger to keep publications.likes_count in sync and an atomic toggle RPC

/* Trigger function to update publications.likes_count on likes insert/delete */
create or replace function publications_update_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') then
    update publications
      set likes_count = (
        select count(*)::integer from likes where publication_id = NEW.publication_id
      )
      where id = NEW.publication_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update publications
      set likes_count = (
        select count(*)::integer from likes where publication_id = OLD.publication_id
      )
      where id = OLD.publication_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_likes_after on likes;
create trigger trg_likes_after
  after insert or delete on likes
  for each row execute function publications_update_likes_count();

/* Atomic RPC to toggle like and return resulting liked state and total likes_count */
-- Ensure any previous version with the same signature is removed first
drop function if exists toggle_like(uuid, uuid);

-- Canonical RPC with parameter names expected by some clients: publication_id, user_id
create or replace function _toggle_like_internal(p_publication_id uuid, p_user_id uuid)
returns table(liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from likes l where l.publication_id = p_publication_id and l.user_id = p_user_id) then
    delete from likes l where l.publication_id = p_publication_id and l.user_id = p_user_id;
  else
    insert into likes (publication_id, user_id) values (p_publication_id, p_user_id);
  end if;

  return query
    select exists(select 1 from likes l where l.publication_id = p_publication_id and l.user_id = p_user_id) as liked,
           (select count(*)::integer from likes l where l.publication_id = p_publication_id) as likes_count;
end;
$$;

drop function if exists toggle_like(uuid, uuid);
create or replace function toggle_like(publication_id uuid, user_id uuid)
returns table(liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from _toggle_like_internal(publication_id, user_id);
end;
$$;

-- Wrapper that accepts an auth id (from Supabase Auth) and resolves it to users.id
drop function if exists toggle_like_by_auth(uuid, uuid);
create or replace function toggle_like_by_auth(publication_id uuid, p_auth uuid)
returns table(liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_user uuid;
begin
  select id into resolved_user from users where auth_id = p_auth limit 1;
  if resolved_user is null then
    raise exception 'no user found for auth_id %', p_auth;
  end if;
  return query select * from _toggle_like_internal(publication_id, resolved_user);
end;
$$;
