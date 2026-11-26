-- Proost : schéma initial
-- profils, groupes, membres, fiches de dégustation, photos, RLS

-- ---------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 24),
  created_at timestamptz not null default now()
);

-- Un profil est créé automatiquement à l'inscription (prénom passé en métadonnée)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(trim(new.raw_user_meta_data ->> 'display_name'), ''), 24));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Groupes
-- ---------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '🍺' check (char_length(emoji) <= 16),
  city text check (char_length(city) <= 60),
  start_date date,
  end_date date,
  cover_path text,
  invite_code text not null unique default public.gen_invite_code(),
  closed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- Le créateur devient automatiquement propriétaire
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Fonctions d'aide (security definer pour éviter la récursion des policies)
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------
-- Fiches de dégustation
-- ---------------------------------------------------------------
create table public.tastings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid references public.groups (id) on delete set null,
  category text not null default 'beer',
  item_name text not null check (char_length(item_name) between 1 and 120),
  item_key text not null,
  producer text,
  style text,
  abv numeric(4, 1) check (abv is null or (abv >= 0 and abv <= 100)),
  color text,
  attributes jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  score smallint not null default 0 check (score between 0 and 100),
  again boolean not null default false,
  place text,
  ambiance smallint not null default 0 check (ambiance between 0 and 5),
  price numeric(8, 2) check (price is null or price >= 0),
  volume_cl numeric(6, 1) check (volume_cl is null or volume_cl > 0),
  currency text not null default 'EUR',
  comment text check (char_length(comment) <= 1000),
  photo_path text,
  tasted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tastings_user_idx on public.tastings (user_id, tasted_at desc);
create index tastings_group_idx on public.tastings (group_id, tasted_at desc);
create index tastings_item_idx on public.tastings (category, item_key);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger tastings_touch before update on public.tastings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.tastings enable row level security;

-- Profils : je vois le mien et ceux des gens avec qui je partage un groupe
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Groupes : visibles par leurs membres, modifiables par leur créateur
create policy groups_select on public.groups for select to authenticated
  using (created_by = auth.uid() or public.is_group_member(id));
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy groups_update on public.groups for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy groups_delete on public.groups for delete to authenticated
  using (created_by = auth.uid());

-- Membres : visibles par les membres ; on peut partir, le créateur peut retirer
-- (l'adhésion passe uniquement par join_group)
create policy members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy members_delete on public.group_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid() and user_id <> auth.uid())
  );

-- Fiches : visibles par l'auteur et par les membres du groupe rattaché
create policy tastings_select on public.tastings for select to authenticated
  using (user_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
create policy tastings_insert on public.tastings for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy tastings_update on public.tastings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
create policy tastings_delete on public.tastings for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------
-- Aperçu d'une invitation (avant de rejoindre)
create or replace function public.invite_preview(code text)
returns table (id uuid, name text, emoji text, city text, start_date date, end_date date, members bigint)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.emoji, g.city, g.start_date, g.end_date,
         (select count(*) from public.group_members m where m.group_id = g.id)
  from public.groups g where g.invite_code = lower(trim(code));
$$;

-- Rejoindre un groupe avec son code d'invitation
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into gid from public.groups where invite_code = lower(trim(code));
  if gid is null then raise exception 'invalid_code'; end if;
  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member') on conflict do nothing;
  return gid;
end $$;

-- Régénérer le code (créateur uniquement)
create or replace function public.regenerate_invite_code(gid uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  update public.groups set invite_code = public.gen_invite_code()
  where id = gid and created_by = auth.uid()
  returning invite_code into c;
  if c is null then raise exception 'forbidden'; end if;
  return c;
end $$;

-- Supprimer son compte. Les photos sont supprimées côté client avant l'appel (API Storage).
-- Les groupes partagés avec d'autres sont transmis au membre le plus ancien.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r record; heir uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  for r in select id from public.groups where created_by = uid loop
    select user_id into heir from public.group_members
      where group_id = r.id and user_id <> uid order by joined_at limit 1;
    if heir is not null then
      update public.groups set created_by = heir, cover_path = null where id = r.id;
      update public.group_members set role = 'owner' where group_id = r.id and user_id = heir;
    end if;
  end loop;
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.delete_account() from anon, public;
revoke execute on function public.join_group(text) from anon, public;
revoke execute on function public.regenerate_invite_code(uuid) from anon, public;
grant execute on function public.delete_account() to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Stockage des photos (bucket privé)
-- Chemins : {user_id}/{tasting_id}.jpg, {user_id}/{tasting_id}_thumb.jpg,
--           {user_id}/covers/{group_id}.jpg
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create or replace function public.can_read_photo(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    split_part(path, '/', 1) = auth.uid()::text
    or exists (
      select 1 from public.tastings t
      where t.photo_path = regexp_replace(path, '_thumb\.jpg$', '.jpg')
        and (t.user_id = auth.uid()
             or (t.group_id is not null and public.is_group_member(t.group_id)))
    )
    or exists (
      select 1 from public.groups g
      where g.cover_path = path and public.is_group_member(g.id)
    );
$$;

create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_read_photo(name));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------
-- Temps réel
-- ---------------------------------------------------------------
alter publication supabase_realtime add table public.tastings;
