-- Coleta de violacoes da CSP (Report-Only) do portal.
--
-- A Edge Function csp-report (sem login, verify_jwt = false) grava aqui com o
-- service role. Nenhum acesso para anon/authenticated: leitura so por SQL ou
-- service role. Os relatorios ficam 30 dias (job pg_cron diario).
--
-- Rollback:
--   select cron.unschedule('csp_reports_limpeza_30d');
--   drop table if exists public.csp_reports;

create table if not exists public.csp_reports (
  id           bigint generated always as identity primary key,
  criado_em    timestamptz not null default now(),
  directive    text not null,
  blocked_uri  text,
  document_uri text,
  user_agent   text
);

comment on table public.csp_reports is
  'Violacoes da CSP do portal (Edge Function csp-report). Sem dados pessoais: URIs sem query string, user agent resumido. Retencao 30 dias.';

create index if not exists csp_reports_criado_em_idx on public.csp_reports (criado_em);

alter table public.csp_reports enable row level security;
-- Sem policies de proposito: RLS ligado e nenhuma policy = nada para anon/authenticated.
revoke all on table public.csp_reports from anon, authenticated, public;
revoke all on sequence public.csp_reports_id_seq from anon, authenticated, public;
grant select, insert, delete on table public.csp_reports to service_role;
grant usage on sequence public.csp_reports_id_seq to service_role;

-- Retencao: apaga o que tem mais de 30 dias, todo dia as 03:17 UTC.
select cron.unschedule('csp_reports_limpeza_30d')
where exists (select 1 from cron.job where jobname = 'csp_reports_limpeza_30d');

select cron.schedule(
  'csp_reports_limpeza_30d',
  '17 3 * * *',
  $$delete from public.csp_reports where criado_em < now() - interval '30 days'$$
);
