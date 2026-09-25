-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen.

create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  birth_date date,
  death_date date,
  gender text not null default 'd' check (gender in ('m', 'w', 'd')),
  photo_url text,
  notes text,
  created_at timestamptz not null default now()
);

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

-- Nur angemeldete (also eingeladene) Familienmitglieder dürfen lesen und schreiben.
alter table public.persons enable row level security;
alter table public.relationships enable row level security;

create policy "Familie liest Personen" on public.persons for select to authenticated using (true);
create policy "Familie ändert Personen" on public.persons for all to authenticated using (true) with check (true);
create policy "Familie liest Beziehungen" on public.relationships for select to authenticated using (true);
create policy "Familie ändert Beziehungen" on public.relationships for all to authenticated using (true) with check (true);

-- Fotos: öffentlich abrufbar über eine zufällige, nicht erratbare Adresse,
-- hochladen und löschen nur für angemeldete Familienmitglieder.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "Familie lädt Fotos hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos');
create policy "Familie ändert Fotos" on storage.objects for update to authenticated
  using (bucket_id = 'photos');
create policy "Familie löscht Fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos');
