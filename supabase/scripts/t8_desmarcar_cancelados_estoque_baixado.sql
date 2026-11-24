-- T8: desmarcar os 664 pedidos cancelados com estoque_baixado = true, SEM estornar.
--
-- Decisao do dono (24/11/2026): nao devolver o estoque desses pedidos. O
-- estoque foi editado no cadastro (provavel recontagem em 18/11) e estornar
-- agora inflaria o saldo; o fornecedor faz a contagem fisica dos produtos
-- ativos afetados e lanca o ajuste pela Gestao de Estoque.
--
-- Por que desmarcar: com o trigger trg_pedidos_zz_estoque (fase 2), um pedido
-- cancelado que o admin reabrisse e cancelasse de novo devolveria o estoque
-- inesperadamente. Desmarcado, isso nao acontece.
--
-- O que o script faz, numa transacao so:
--   * backup (id, status, estoque_baixado, updated_at) em backups._t8_cancelados_estoque_baixado_20261124;
--   * UPDATE so de estoque_baixado. NAO dispara o estorno: o trigger novo e
--     "before update of status, itens";
--   * desliga, so durante o UPDATE, o update_pedidos_updated_at (os pedidos
--     nao "sobem" nas listas por data) e o trg_notify_pedido_change (664
--     chamadas ao webhook a toa; o notify-pedido nao manda e-mail para essa
--     mudanca, de todo jeito);
--   * o trg_pedidos_historico continua ligado: cada pedido ganha uma linha
--     'alterado' com estoque_baixado de true para false. Essa e a marcacao.
--
-- Testado antes numa transacao desfeita: 664 no backup, 664 atualizados,
-- 664 linhas de historico, 0 movimentacoes de estoque, estoque total igual,
-- updated_at preservado.
--
-- Rollback (devolve o sinal; nao mexe em estoque):
--   begin;
--   set local lock_timeout = '3s';
--   alter table public.pedidos disable trigger update_pedidos_updated_at;
--   alter table public.pedidos disable trigger trg_notify_pedido_change;
--   update public.pedidos p set estoque_baixado = b.estoque_baixado
--     from backups._t8_cancelados_estoque_baixado_20261124 b
--    where p.id = b.id and p.status = 'cancelado';
--   alter table public.pedidos enable trigger update_pedidos_updated_at;
--   alter table public.pedidos enable trigger trg_notify_pedido_change;
--   commit;

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table backups._t8_cancelados_estoque_baixado_20261124 as
  select id, status, estoque_baixado, updated_at, now() as backup_em
    from public.pedidos
   where status = 'cancelado' and estoque_baixado;
alter table backups._t8_cancelados_estoque_baixado_20261124 enable row level security;
revoke all on backups._t8_cancelados_estoque_baixado_20261124 from anon, authenticated;

alter table public.pedidos disable trigger update_pedidos_updated_at;
alter table public.pedidos disable trigger trg_notify_pedido_change;

update public.pedidos p
   set estoque_baixado = false
  from backups._t8_cancelados_estoque_baixado_20261124 b
 where p.id = b.id
   and p.status = 'cancelado'
   and p.estoque_baixado;

alter table public.pedidos enable trigger update_pedidos_updated_at;
alter table public.pedidos enable trigger trg_notify_pedido_change;

commit;
