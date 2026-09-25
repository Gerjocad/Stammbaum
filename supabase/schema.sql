-- Im Supabase-Dashboard unter "SQL Editor" komplett einfügen und ausführen.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden, auch nach Updates der App.

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  birth_name text,
  birth_date date,
  death_date date,
  gender text not null default 'd' check (gender in ('m', 'w', 'd')),
  photo_url text,
  notes text,
  created_at timestamptz not null default now()
);
-- Nachträge für ältere Datenbanken
alter table public.persons add column if not exists birth_name text;

-- type = 'parent': person_a ist Elternteil von person_b
-- type = 'partner': person_a und person_b sind Partner
create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('parent', 'partner')),
  person_a uuid not null references public.persons (id) on delete cascade,
  person_b uuid not null references public.persons (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (person_a <> person_b),
  unique (type, person_a, person_b)
);

-- Profile der Familienmitglieder mit Rolle:
-- viewer = nur ansehen, editor = bearbeiten, admin = bearbeiten und Rollen vergeben.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.can_edit() returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce((select role in ('editor', 'admin') from public.profiles where id = auth.uid()), false) $$;

-- Wer sich registriert, bekommt ein Profil mit "nur ansehen".
-- Gibt es noch keine Verwaltung (admin), wird die erste Person admin.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when exists (select 1 from public.profiles where role = 'admin') then 'viewer' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bereits vorhandene (eingeladene) Konten durften bisher bearbeiten und behalten das.
-- Das älteste Konto wird admin, falls es noch keinen admin gibt.
insert into public.profiles (id, email, name, role)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'name', ''), 'editor'
from auth.users u
on conflict (id) do nothing;

update public.profiles set role = 'admin'
where not exists (select 1 from public.profiles where role = 'admin')
  and id = (select id from auth.users order by created_at limit 1);

-- Zugriffsregeln: Alle mit Profil dürfen lesen, nur editor und admin ändern.
alter table public.persons enable row level security;
alter table public.relationships enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Familie liest Personen" on public.persons;
drop policy if exists "Familie ändert Personen" on public.persons;
drop policy if exists "Familie liest Beziehungen" on public.relationships;
drop policy if exists "Familie ändert Beziehungen" on public.relationships;
drop policy if exists "Familie legt Personen an" on public.persons;
drop policy if exists "Familie bearbeitet Personen" on public.persons;
drop policy if exists "Familie löscht Personen" on public.persons;
drop policy if exists "Familie legt Beziehungen an" on public.relationships;
drop policy if exists "Familie bearbeitet Beziehungen" on public.relationships;
drop policy if exists "Familie löscht Beziehungen" on public.relationships;

create policy "Familie liest Personen" on public.persons for select to authenticated
  using (public.my_role() is not null);
create policy "Familie legt Personen an" on public.persons for insert to authenticated
  with check (public.can_edit());
create policy "Familie bearbeitet Personen" on public.persons for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
create policy "Familie löscht Personen" on public.persons for delete to authenticated
  using (public.can_edit());

create policy "Familie liest Beziehungen" on public.relationships for select to authenticated
  using (public.my_role() is not null);
create policy "Familie legt Beziehungen an" on public.relationships for insert to authenticated
  with check (public.can_edit());
create policy "Familie bearbeitet Beziehungen" on public.relationships for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
create policy "Familie löscht Beziehungen" on public.relationships for delete to authenticated
  using (public.can_edit());

drop policy if exists "Eigenes Profil oder Verwaltung" on public.profiles;
drop policy if exists "Verwaltung vergibt Rollen" on public.profiles;
create policy "Eigenes Profil oder Verwaltung" on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() = 'admin');
create policy "Verwaltung vergibt Rollen" on public.profiles for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Fotos: öffentlich abrufbar über eine zufällige, nicht erratbare Adresse,
-- hochladen und löschen nur für editor und admin.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "Familie lädt Fotos hoch" on storage.objects;
drop policy if exists "Familie ändert Fotos" on storage.objects;
drop policy if exists "Familie löscht Fotos" on storage.objects;
create policy "Familie lädt Fotos hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.can_edit());
create policy "Familie ändert Fotos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.can_edit());
create policy "Familie löscht Fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_edit());
