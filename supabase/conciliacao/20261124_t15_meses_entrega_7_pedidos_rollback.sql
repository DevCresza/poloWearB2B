-- Rollback de 20261124_t15_meses_entrega_7_pedidos.sql.
--
-- Volta meses_entrega_efetivos dos 7 pedidos ao valor do backup
-- (backups._t15_meses_20261124_pedidos). Não mexe em mais nada. Mesma
-- regra do script: triggers de pedidos desligados só dentro da transação
-- (session_replication_role = replica), sem e-mail, histórico ou updated_at.
--
-- Atenção: o valor antigo é o desatualizado. Se algum dos 7 tiver mudado
-- itens depois da correção, o trigger já recalculou a coluna e o rollback
-- desse pedido é pulado (conferido pelo updated_at).

begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

set local session_replication_role = replica;

update public.pedidos p
   set meses_entrega_efetivos = b.meses_entrega_efetivos
  from backups._t15_meses_20261124_pedidos b
 where b.id = p.id
   and p.updated_at is not distinct from b.updated_at;

set local session_replication_role = origin;

do $$
declare n int;
begin
  select count(*) into n
    from public.pedidos p join backups._t15_meses_20261124_pedidos b on b.id = p.id
   where p.meses_entrega_efetivos is not distinct from b.meses_entrega_efetivos;
  raise notice 'Pedidos de volta ao valor do backup: % de 7', n;
end $$;

commit;
