-- M11: desfaz a troca de URLs feita por troca_urls.sql.
--
-- Volta cada URL nova para a antiga, usando backups.fotos_otimizadas_troca.
-- Troca so as strings exatas: se alguem editou o produto depois (preco, estoque,
-- outra foto), essa edicao e mantida. As fotos novas enviadas depois da troca
-- (uploads do proprio portal) tambem ficam.
--
-- Os originais nunca sairam do bucket, entao as URLs antigas voltam a funcionar
-- na hora. Os arquivos otimizadas/... podem ficar (nao atrapalham) ou ser apagados
-- depois, por decisao do dono.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local session_replication_role = replica;


update public.produtos p
   set fotos = backups.trocar_urls(p.fotos, m.de, m.para)
  from (select registro_id, array_agg(url_nova) de, array_agg(url_antiga) para
          from backups.fotos_otimizadas_troca
         where lote = 'm11-2026-11-23' and tabela = 'produtos' and coluna = 'fotos'
           and desfeito_em is null
         group by registro_id) m
 where p.id = m.registro_id;

update public.produtos p
   set variantes_cor = backups.trocar_urls(p.variantes_cor, m.de, m.para)
  from (select registro_id, array_agg(url_nova) de, array_agg(url_antiga) para
          from backups.fotos_otimizadas_troca
         where lote = 'm11-2026-11-23' and tabela = 'produtos' and coluna = 'variantes_cor'
           and desfeito_em is null
         group by registro_id) m
 where p.id = m.registro_id;

update public.capsulas c
   set imagem_capa_url = t.url_antiga
  from backups.fotos_otimizadas_troca t
 where t.lote = 'm11-2026-11-23' and t.tabela = 'capsulas' and t.desfeito_em is null
   and c.id = t.registro_id and c.imagem_capa_url = t.url_nova;

update public.banners b
   set imagem_url = t.url_antiga
  from backups.fotos_otimizadas_troca t
 where t.lote = 'm11-2026-11-23' and t.tabela = 'banners' and t.desfeito_em is null
   and b.id = t.registro_id and b.imagem_url = t.url_nova;

update backups.fotos_otimizadas_troca
   set desfeito_em = now()
 where lote = 'm11-2026-11-23' and desfeito_em is null;

-- Conferencia: nenhuma URL nova deste lote pode ter sobrado.
do $$
declare restantes int;
begin
  select count(*) into restantes
    from backups.fotos_otimizadas_troca t
   where t.lote = 'm11-2026-11-23'
     and (exists (select 1 from public.produtos p where p.id = t.registro_id
                    and (p.fotos::text like '%' || t.url_nova || '"%'
                         or p.variantes_cor::text like '%' || t.url_nova || '"%'))
       or exists (select 1 from public.capsulas c where c.id = t.registro_id and c.imagem_capa_url = t.url_nova)
       or exists (select 1 from public.banners b where b.id = t.registro_id and b.imagem_url = t.url_nova));
  if restantes > 0 then
    raise exception 'M11 rollback: % URLs novas ainda referenciadas', restantes;
  end if;
end $$;

commit;

-- Ultimo recurso (sobrescreve a coluna inteira, perdendo edicoes posteriores):
--   update public.produtos p set fotos = a.valor
--     from backups.fotos_otimizadas_antes a
--    where a.lote = 'm11-2026-11-23' and a.tabela = 'produtos' and a.coluna = 'fotos' and p.id = a.registro_id;
--   (idem para variantes_cor, capsulas.imagem_capa_url e banners.imagem_url com valor #>> '{}')
