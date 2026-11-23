-- M11: reprocessamento do acervo de fotos (versoes WebP <= 1600 px).
--
-- Cria, no schema backups (fechado: sem grant para anon/authenticated), o que a
-- troca de URLs precisa para ser auditavel e reversivel:
--   * backups.fotos_otimizadas        mapa arquivo original -> versao otimizada
--   * backups.fotos_otimizadas_troca  cada URL trocada: tabela, id, coluna, antiga, nova
--   * backups.fotos_otimizadas_antes  valor inteiro da coluna antes da troca
--   * backups.trocar_urls(jsonb, text[], text[])  troca strings JSON exatas
--
-- A troca em si e o rollback estao em supabase/scripts/m11_fotos_otimizadas/.
-- Nenhum arquivo do Storage e apagado.
--
-- Rollback desta migracao (so depois de desfazer a troca com rollback_troca.sql,
-- e so quando o dono decidir que o backup nao e mais necessario):
--   drop function if exists backups.trocar_urls(jsonb, text[], text[]);
--   drop table if exists backups.fotos_otimizadas_antes;
--   drop table if exists backups.fotos_otimizadas_troca;
--   drop table if exists backups.fotos_otimizadas;

create schema if not exists backups;

create table if not exists backups.fotos_otimizadas (
  nome_original  text primary key,          -- bucket/caminho do original
  url_antiga     text not null unique,
  url_nova       text not null unique,
  bytes_antes    integer not null,
  bytes_depois   integer not null check (bytes_depois < bytes_antes),
  largura_antes  integer,
  altura_antes   integer,
  largura_depois integer,
  altura_depois  integer,
  criado_em      timestamptz not null default now()
);

create table if not exists backups.fotos_otimizadas_troca (
  id          bigserial primary key,
  lote        text not null,
  tabela      text not null,
  registro_id uuid not null,
  coluna      text not null,
  url_antiga  text not null,
  url_nova    text not null,
  trocado_em  timestamptz not null default now(),
  desfeito_em timestamptz
);
create index if not exists fotos_otimizadas_troca_lote_idx
  on backups.fotos_otimizadas_troca (lote, tabela, registro_id);

create table if not exists backups.fotos_otimizadas_antes (
  lote        text not null,
  tabela      text not null,
  registro_id uuid not null,
  coluna      text not null,
  valor       jsonb,
  salvo_em    timestamptz not null default now(),
  primary key (lote, tabela, registro_id, coluna)
);

-- Troca strings JSON *exatas* ("url") dentro de um jsonb. Nao toca em nenhum
-- outro valor (precos, estoque etc. de variantes_cor ficam iguais).
create or replace function backups.trocar_urls(j jsonb, de text[], para text[])
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  t text;
  i int;
begin
  if j is null or de is null then
    return j;
  end if;
  t := j::text;
  for i in 1 .. coalesce(array_length(de, 1), 0) loop
    t := replace(t, to_json(de[i])::text, to_json(para[i])::text);
  end loop;
  return t::jsonb;
end;
$$;

alter table backups.fotos_otimizadas       enable row level security;
alter table backups.fotos_otimizadas_troca enable row level security;
alter table backups.fotos_otimizadas_antes enable row level security;

revoke all on backups.fotos_otimizadas, backups.fotos_otimizadas_troca,
              backups.fotos_otimizadas_antes from public, anon, authenticated;
revoke all on sequence backups.fotos_otimizadas_troca_id_seq from public, anon, authenticated;
revoke all on function backups.trocar_urls(jsonb, text[], text[]) from public, anon, authenticated;
