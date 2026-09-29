-- CENTRAL DE PROSPECÇÃO VIVI - V1
-- Execute este arquivo no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;

drop type if exists public.pipeline_stage cascade;
create type public.pipeline_stage as enum (
  'MUNICÍPIO PESQUISADO',
  'CONTATO IDENTIFICADO',
  'PRIMEIRO CONTATO',
  'AGUARDANDO RESPOSTA',
  'RESPONDEU',
  'CONVERSA EM ANDAMENTO',
  'PROPOSTA ENVIADA',
  'EM ANÁLISE',
  'NEGOCIAÇÃO',
  'FECHADO',
  'NÃO AVANÇOU',
  'RETOMAR DEPOIS'
);

create type public.interaction_type as enum (
  'E-mail enviado',
  'E-mail recebido',
  'WhatsApp enviado',
  'WhatsApp recebido',
  'Ligação',
  'Reunião',
  'Proposta enviada',
  'Retorno recebido',
  'Observação'
);

create table if not exists public.municipalities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  state char(2) not null,
  secretaria text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null,
  role text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.proposal_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  proposal_type_id uuid references public.proposal_types(id) on delete set null,
  primary_contact_id uuid references public.contacts(id) on delete set null,
  stage public.pipeline_stage not null default 'MUNICÍPIO PESQUISADO',
  first_contact_date date,
  last_interaction_at timestamptz,
  next_action text not null default '',
  next_action_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, municipality_id, project_id)
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type public.interaction_type not null,
  description text not null default '',
  observation text not null default ''
);

create index if not exists municipalities_user_idx on public.municipalities(user_id);
create index if not exists contacts_municipality_idx on public.contacts(municipality_id);
create index if not exists contacts_user_idx on public.contacts(user_id);
create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists proposal_types_project_idx on public.proposal_types(project_id);
create index if not exists opportunities_user_stage_idx on public.opportunities(user_id, stage);
create index if not exists opportunities_next_action_idx on public.opportunities(user_id, next_action_date);
create index if not exists interactions_opportunity_date_idx on public.interactions(opportunity_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists municipalities_updated_at on public.municipalities;
create trigger municipalities_updated_at before update on public.municipalities for each row execute function public.set_updated_at();
drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists proposal_types_updated_at on public.proposal_types;
create trigger proposal_types_updated_at before update on public.proposal_types for each row execute function public.set_updated_at();
drop trigger if exists opportunities_updated_at on public.opportunities;
create trigger opportunities_updated_at before update on public.opportunities for each row execute function public.set_updated_at();

-- Garante que o contato principal e a modalidade selecionada pertencem ao mesmo usuário.
create or replace function public.validate_opportunity_links()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.municipalities m where m.id = new.municipality_id and m.user_id = new.user_id) then
    raise exception 'Município inválido para este usuário';
  end if;
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'Projeto inválido para este usuário';
  end if;
  if new.proposal_type_id is not null and not exists (
    select 1 from public.proposal_types pt where pt.id = new.proposal_type_id and pt.user_id = new.user_id and pt.project_id = new.project_id
  ) then
    raise exception 'Modalidade inválida para este projeto';
  end if;
  if new.primary_contact_id is not null and not exists (
    select 1 from public.contacts c where c.id = new.primary_contact_id and c.user_id = new.user_id and c.municipality_id = new.municipality_id
  ) then
    raise exception 'Contato principal inválido para este município';
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_validate_links on public.opportunities;
create trigger opportunities_validate_links before insert or update on public.opportunities for each row execute function public.validate_opportunity_links();

alter table public.municipalities enable row level security;
alter table public.contacts enable row level security;
alter table public.projects enable row level security;
alter table public.proposal_types enable row level security;
alter table public.opportunities enable row level security;
alter table public.interactions enable row level security;

-- Recria políticas para permitir execução idempotente deste arquivo.
drop policy if exists municipalities_select on public.municipalities;
drop policy if exists municipalities_insert on public.municipalities;
drop policy if exists municipalities_update on public.municipalities;
drop policy if exists municipalities_delete on public.municipalities;
create policy municipalities_select on public.municipalities for select to authenticated using (user_id = (select auth.uid()));
create policy municipalities_insert on public.municipalities for insert to authenticated with check (user_id = (select auth.uid()));
create policy municipalities_update on public.municipalities for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy municipalities_delete on public.municipalities for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists contacts_select on public.contacts;
drop policy if exists contacts_insert on public.contacts;
drop policy if exists contacts_update on public.contacts;
drop policy if exists contacts_delete on public.contacts;
create policy contacts_select on public.contacts for select to authenticated using (user_id = (select auth.uid()));
create policy contacts_insert on public.contacts for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.municipalities m where m.id = municipality_id and m.user_id = (select auth.uid())));
create policy contacts_update on public.contacts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.municipalities m where m.id = municipality_id and m.user_id = (select auth.uid())));
create policy contacts_delete on public.contacts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_select on public.projects for select to authenticated using (user_id = (select auth.uid()));
create policy projects_insert on public.projects for insert to authenticated with check (user_id = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy projects_delete on public.projects for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists proposal_types_select on public.proposal_types;
drop policy if exists proposal_types_insert on public.proposal_types;
drop policy if exists proposal_types_update on public.proposal_types;
drop policy if exists proposal_types_delete on public.proposal_types;
create policy proposal_types_select on public.proposal_types for select to authenticated using (user_id = (select auth.uid()));
create policy proposal_types_insert on public.proposal_types for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy proposal_types_update on public.proposal_types for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy proposal_types_delete on public.proposal_types for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists opportunities_select on public.opportunities;
drop policy if exists opportunities_insert on public.opportunities;
drop policy if exists opportunities_update on public.opportunities;
drop policy if exists opportunities_delete on public.opportunities;
create policy opportunities_select on public.opportunities for select to authenticated using (user_id = (select auth.uid()));
create policy opportunities_insert on public.opportunities for insert to authenticated with check (user_id = (select auth.uid()));
create policy opportunities_update on public.opportunities for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy opportunities_delete on public.opportunities for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists interactions_select on public.interactions;
drop policy if exists interactions_insert on public.interactions;
drop policy if exists interactions_update on public.interactions;
drop policy if exists interactions_delete on public.interactions;
create policy interactions_select on public.interactions for select to authenticated using (user_id = (select auth.uid()));
create policy interactions_insert on public.interactions for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.user_id = (select auth.uid())));
create policy interactions_update on public.interactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.user_id = (select auth.uid())));
create policy interactions_delete on public.interactions for delete to authenticated using (user_id = (select auth.uid()));

-- Privilégios mínimos para a role autenticada.
revoke all on public.municipalities, public.contacts, public.projects, public.proposal_types, public.opportunities, public.interactions from anon;
grant select, insert, update, delete on public.municipalities, public.contacts, public.projects, public.proposal_types, public.opportunities, public.interactions to authenticated;

-- Dados iniciais para cada nova conta: apenas o projeto e modalidades especificados na V1.
create or replace function public.seed_new_user_defaults()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  caraminholas_id uuid;
begin
  insert into public.projects (user_id, name) values (new.id, 'Caraminholas') returning id into caraminholas_id;
  insert into public.proposal_types (user_id, project_id, name) values
    (new.id, caraminholas_id, 'Projeto completo + formação'),
    (new.id, caraminholas_id, 'Projeto sem formação'),
    (new.id, caraminholas_id, 'Acervo literário');
  return new;
end;
$$;

drop trigger if exists seed_new_user_defaults on auth.users;
create trigger seed_new_user_defaults after insert on auth.users for each row execute function public.seed_new_user_defaults();
