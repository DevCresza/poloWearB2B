-- Rollback de 20261124_t7_faturamento_retroativo.sql.
--
-- Volta os 372 pedidos ao estado do backup (itens, valor_faturado e
-- meses_faturamento), remove os 304 faturamentos marcados 'retroativo T7
-- 24/11/2026' e as 68 linhas de histórico da marcação. Não toca em títulos
-- (o script original também não tocou).
--
-- Contém DELETE: o MCP do Supabase pede a confirmação manual do dono.
-- Rodar como dono do banco, numa transação só.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.pedidos disable trigger user;

-- Faturamentos retroativos (sem título vinculado: conferido abaixo).
do $$
begin
  if exists (select 1 from public.carteira c
               join public.faturamentos f on f.id = c.faturamento_id
              where f.observacoes = 'retroativo T7 24/11/2026') then
    raise exception 'Há títulos ligados a faturamentos retroativos: resolver antes do rollback';
  end if;
end $$;

delete from public.faturamentos where observacoes = 'retroativo T7 24/11/2026';

update public.pedidos p
   set itens             = b.itens,
       valor_faturado    = b.valor_faturado,
       meses_faturamento = b.meses_faturamento
  from backups._t7_retro_20261124_pedidos b
 where b.id = p.id;

delete from public.pedido_historico h
 using backups._t7_retro_20261124_pedidos b
 where h.pedido_id = b.id
   and b.acao_t7 = 'marcar'
   and h.autor_papel = 'service_role'
   and h.mudancas->'observacao'->>'para' like '%retroativo T7 24/11/2026%';

alter table public.pedidos enable trigger user;

do $$
declare n int;
begin
  select count(*) into n from public.faturamentos where observacoes = 'retroativo T7 24/11/2026';
  if n <> 0 then raise exception 'Sobraram % faturamentos retroativos', n; end if;
end $$;

commit;
