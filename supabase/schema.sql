-- Hub de Trabajos Cientificos — schema
-- Correr en el SQL Editor de Supabase

create table papers (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null default 'Nuevo trabajo sin titulo',
  authors     text[]      not null default '{}',
  status      text        not null default 'Idea',
  link        text        not null default '',
  tags        text[]      not null default '{}',
  abstract    text        not null default '',
  media       jsonb       not null default '[]',
  updated_at  timestamptz not null default now()
);
