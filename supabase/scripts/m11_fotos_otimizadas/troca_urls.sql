-- M11: troca as URLs das fotos de produtos e capsulas pelas versoes otimizadas.
-- Lote: 'm11-2026-11-23' (para rodar de novo, troque o literal em todo o arquivo).
--
-- Pre-requisitos:
--   1. migracao 20261123233618_fotos_otimizadas_backup aplicada;
--   2. backups.fotos_otimizadas preenchida (so arquivos ja enviados ao Storage
--      e cuja versao nova e menor que a original);
--   3. os arquivos otimizadas/... existem no bucket produtos (conferido abaixo).
--
-- O que muda: produtos.fotos, produtos.variantes_cor, capsulas.imagem_capa_url
-- e banners.imagem_url. NAO mexe em pedidos.itens: o historico dos pedidos continua
-- apontando para os originais, que ficam no bucket.
--
-- Os triggers de updated_at ficam desligados so nesta transacao
-- (session_replication_role = replica): trocar a URL da foto nao e uma edicao do
-- produto, e o "Ultima modificacao" do cadastro deve continuar o mesmo.
--
-- Rollback: rollback_troca.sql (usa backups.fotos_otimizadas_troca).

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local session_replication_role = replica;


-- 0. Todo arquivo do mapa precisa existir no Storage.
do $$
declare faltando int;
begin
  select count(*) into faltando
    from backups.fotos_otimizadas f
   where not exists (
     select 1 from storage.objects o
      where o.bucket_id = 'produtos'
        and o.name = substr(f.url_nova, length('https://jbdcoftzffrppkyzdaqr.supabase.co/storage/v1/object/public/produtos/') + 1));
  if faltando > 0 then
    raise exception 'M11: % arquivos otimizados nao estao no Storage', faltando;
  end if;
end $$;

-- 1. Trava as linhas que serao tocadas.
select 1 from public.produtos
 where fotos::text like '%/object/public/produtos/produtos/%'
    or variantes_cor::text like '%/object/public/produtos/produtos/%'
   for update;
select 1 from public.capsulas where imagem_capa_url like '%/object/public/produtos/produtos/%' for update;
select 1 from public.banners for update;

-- 2. Registra cada URL que vai ser trocada.
insert into backups.fotos_otimizadas_troca (lote, tabela, registro_id, coluna, url_antiga, url_nova)
select 'm11-2026-11-23', 'produtos', x.id, x.coluna, f.url_antiga, f.url_nova
  from (
    select distinct p.id, 'fotos'::text as coluna, v #>> '{}' as url
      from public.produtos p, jsonb_path_query(p.fotos, 'strict $.**') v
     where jsonb_typeof(v) = 'string'
    union
    select distinct p.id, 'variantes_cor', v #>> '{}'
      from public.produtos p, jsonb_path_query(p.variantes_cor, 'strict $.**') v
     where jsonb_typeof(v) = 'string'
  ) x
  join backups.fotos_otimizadas f on f.url_antiga = x.url;

insert into backups.fotos_otimizadas_troca (lote, tabela, registro_id, coluna, url_antiga, url_nova)
select 'm11-2026-11-23', 'capsulas', c.id, 'imagem_capa_url', f.url_antiga, f.url_nova
  from public.capsulas c join backups.fotos_otimizadas f on f.url_antiga = c.imagem_capa_url;

insert into backups.fotos_otimizadas_troca (lote, tabela, registro_id, coluna, url_antiga, url_nova)
select 'm11-2026-11-23', 'banners', b.id, 'imagem_url', f.url_antiga, f.url_nova
  from public.banners b join backups.fotos_otimizadas f on f.url_antiga = b.imagem_url;

-- 3. Guarda o valor inteiro de cada coluna antes da troca.
insert into backups.fotos_otimizadas_antes (lote, tabela, registro_id, coluna, valor)
select distinct t.lote, t.tabela, t.registro_id, t.coluna,
       case t.coluna when 'fotos' then p.fotos when 'variantes_cor' then p.variantes_cor end
  from backups.fotos_otimizadas_troca t join public.produtos p on p.id = t.registro_id
 where t.lote = 'm11-2026-11-23' and t.tabela = 'produtos';
insert into backups.fotos_otimizadas_antes (lote, tabela, registro_id, coluna, valor)
select distinct t.lote, t.tabela, t.registro_id, t.coluna, to_jsonb(c.imagem_capa_url)
  from backups.fotos_otimizadas_troca t join public.capsulas c on c.id = t.registro_id
 where t.lote = 'm11-2026-11-23' and t.tabela = 'capsulas';
insert into backups.fotos_otimizadas_antes (lote, tabela, registro_id, coluna, valor)
select distinct t.lote, t.tabela, t.registro_id, t.coluna, to_jsonb(b.imagem_url)
  from backups.fotos_otimizadas_troca t join public.banners b on b.id = t.registro_id
 where t.lote = 'm11-2026-11-23' and t.tabela = 'banners';

-- 4. Troca.
update public.produtos p
   set fotos = backups.trocar_urls(p.fotos, m.de, m.para)
  from (select registro_id, array_agg(url_antiga) de, array_agg(url_nova) para
          from backups.fotos_otimizadas_troca
         where lote = 'm11-2026-11-23' and tabela = 'produtos' and coluna = 'fotos'
         group by registro_id) m
 where p.id = m.registro_id;

update public.produtos p
   set variantes_cor = backups.trocar_urls(p.variantes_cor, m.de, m.para)
  from (select registro_id, array_agg(url_antiga) de, array_agg(url_nova) para
          from backups.fotos_otimizadas_troca
         where lote = 'm11-2026-11-23' and tabela = 'produtos' and coluna = 'variantes_cor'
         group by registro_id) m
 where p.id = m.registro_id;

update public.capsulas c
   set imagem_capa_url = t.url_nova
  from backups.fotos_otimizadas_troca t
 where t.lote = 'm11-2026-11-23' and t.tabela = 'capsulas'
   and c.id = t.registro_id and c.imagem_capa_url = t.url_antiga;

update public.banners b
   set imagem_url = t.url_nova
  from backups.fotos_otimizadas_troca t
 where t.lote = 'm11-2026-11-23' and t.tabela = 'banners'
   and b.id = t.registro_id and b.imagem_url = t.url_antiga;

-- 5. Conferencia: desfazer a troca em memoria tem de dar exatamente o valor salvo.
do $$
declare divergentes int; restantes int;
begin
  select count(*) into divergentes
    from backups.fotos_otimizadas_antes a
    join public.produtos p on p.id = a.registro_id
    join lateral (
      select array_agg(url_nova) de, array_agg(url_antiga) para
        from backups.fotos_otimizadas_troca t
       where t.lote = a.lote and t.tabela = a.tabela and t.registro_id = a.registro_id and t.coluna = a.coluna
    ) m on true
   where a.lote = 'm11-2026-11-23' and a.tabela = 'produtos'
     and backups.trocar_urls(case a.coluna when 'fotos' then p.fotos else p.variantes_cor end, m.de, m.para)
         is distinct from a.valor;
  if divergentes > 0 then
    raise exception 'M11: % colunas divergem do backup apos a troca', divergentes;
  end if;

  -- Nenhuma URL do mapa pode ter sobrado em produtos/capsulas/banners.
  select count(distinct f.url_antiga) into restantes
    from backups.fotos_otimizadas f
    join (
      select v #>> '{}' as url from public.produtos p, jsonb_path_query(p.fotos, 'strict $.**') v
       where jsonb_typeof(v) = 'string'
      union all
      select v #>> '{}' from public.produtos p, jsonb_path_query(p.variantes_cor, 'strict $.**') v
       where jsonb_typeof(v) = 'string'
      union all select imagem_capa_url from public.capsulas
      union all select imagem_url from public.banners
    ) s on s.url = f.url_antiga;
  if restantes > 0 then
    raise exception 'M11: % URLs antigas ainda referenciadas', restantes;
  end if;
end $$;

commit;
