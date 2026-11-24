-- Conciliação de 23/11/2026 (T6 / C6), aprovada pelo dono, caso a caso.
--
-- 10 pedidos receberam o boleto "pelo pedido" em 05/11 e, de 30 s a 3 min
-- depois, o boleto corrigido. O fornecedor não tinha permissão para apagar o
-- primeiro jogo, então os dois ficaram: o cliente aparecia devendo o dobro, com
-- a parcela 1 do primeiro jogo já vencida.
--
-- Este script:
--   1. copia as linhas afetadas para backups._conciliacao_20261123_carteira;
--   2. cancela o PRIMEIRO jogo de cada pedido (status 'cancelado', sem apagar),
--      com observação;
--   3. no 274EC4F1, que já tem nota, vincula o jogo mantido à nota;
--   4. recalcula os totais dos clientes envolvidos.
-- Nenhum e-mail é disparado: o notify-pedido só envia, a partir da carteira, em
-- comprovante enviado/recusado ou título virando 'pago'.
--
-- Primeiro jogo = títulos com parcela, sem faturamento_id, não cancelados,
-- criados até 10 s depois do primeiro título do pedido (os dois envios estão a
-- 30 s ou mais um do outro). Esperado: 26 títulos, R$ 344.822,52.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table backups._conciliacao_20261123_carteira as
select c.*, (c.created_at < x.primeiro + interval '10 seconds') as primeiro_jogo
  from public.carteira c
  join (select pedido_id, min(created_at) primeiro
          from public.carteira
         where parcela_numero is not null and faturamento_id is null and status <> 'cancelado'
         group by pedido_id) x on x.pedido_id = c.pedido_id
 where c.parcela_numero is not null and c.faturamento_id is null and c.status <> 'cancelado'
   and upper(right(c.pedido_id::text, 8)) in ('60443DE7','0B51BCAC','FBE9CB38','FF63BE12','4F8196C1',
                                              '274EC4F1','CA94BD12','51BB027D','D6D23062','8C8AD1D5');
alter table backups._conciliacao_20261123_carteira enable row level security;

do $$
declare n int; s numeric;
begin
  select count(*), sum(valor) into n, s from backups._conciliacao_20261123_carteira where primeiro_jogo;
  if n <> 26 or s <> 344822.52 or exists (select 1 from backups._conciliacao_20261123_carteira where status <> 'pendente') then
    raise exception 'Conferência falhou: % títulos, R$ % (esperado 26 e 344822.52, todos pendentes)', n, s;
  end if;
end $$;

-- 2. Cancela o primeiro jogo.
update public.carteira c
   set status = 'cancelado',
       observacoes = trim(both E'\n' from coalesce(c.observacoes, '') || E'\n'
         || 'Conciliação 23/11/2026 (aprovada pelo dono): boleto reenviado em 05/11; este era o 1º jogo, duplicado. Vale o 2º jogo.'),
       updated_at = now()
  from backups._conciliacao_20261123_carteira b
 where b.id = c.id and b.primeiro_jogo;

-- 3. 274EC4F1: o jogo mantido passa a pertencer à nota (o pedido tem uma só).
update public.carteira c
   set faturamento_id = f.id, updated_at = now()
  from backups._conciliacao_20261123_carteira b, public.faturamentos f
 where b.id = c.id and not b.primeiro_jogo
   and upper(right(b.pedido_id::text, 8)) = '274EC4F1'
   and f.pedido_id = b.pedido_id
   and (select count(*) from public.faturamentos f2 where f2.pedido_id = b.pedido_id) = 1;

-- 4. Totais dos clientes (o trigger já recalcula por linha; aqui é a garantia).
select public.recalcular_totais_cliente(cliente_user_id)
  from (select distinct cliente_user_id from backups._conciliacao_20261123_carteira) x;

commit;

-- ROLLBACK (volta status, observação e faturamento_id a partir do backup):
--
-- begin;
-- update public.carteira c
--    set status = b.status, observacoes = b.observacoes, faturamento_id = b.faturamento_id, updated_at = now()
--   from backups._conciliacao_20261123_carteira b
--  where b.id = c.id;
-- select public.recalcular_totais_cliente(cliente_user_id)
--   from (select distinct cliente_user_id from backups._conciliacao_20261123_carteira) x;
-- commit;
