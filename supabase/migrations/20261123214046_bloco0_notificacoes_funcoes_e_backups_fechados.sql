-- Bloco 0 (restante) de 23/11/2026. O dono autorizou: "pode corrigir tudo que encontrar".

-- C4: ninguem sem login cria notificacao. O front passa a abrir so links internos (tarefa T13).
revoke insert on public.notificacoes from anon;
alter policy "Service can insert notifications" on public.notificacoes to authenticated;

-- A11: funcoes SECURITY DEFINER fora do alcance de quem nao tem login.
-- authenticated mantem o grant explicito onde o app usa (get_produtos_mais_vendidos).
-- As de trigger seguem funcionando: trigger nao checa EXECUTE ao disparar.
revoke execute on function
  public.recalcular_totais_cliente(uuid),
  public.get_produtos_mais_vendidos(),
  public.perform_health_check(),
  public.carteira_sync_totais(),
  public.cascade_cancelar_carteira_ao_cancelar_pedido(),
  public.cascade_pagamento_carteira_ao_atualizar_pedido(),
  public.notify_pedido_change(),
  public.pedidos_bloqueia_cancelar_lote(),
  public.pedidos_registrar_historico(),
  public.produtos_propagar_meses_pedidos()
from anon, public;

-- So o cron (postgres) usa estas duas.
revoke execute on function public.recalcular_totais_cliente(uuid), public.perform_health_check() from authenticated;

-- A view de resumo e so de leitura.
revoke insert, update, delete, truncate, trigger, references on public.pedidos_resumo from authenticated;

-- Backups: saem do schema exposto para o schema backups (sem acesso pela API). Os dados ficam.
alter table public._backup_cancel_massa_20260812_carteira set schema backups;
alter table public._backup_cancel_massa_20260812_pedidos set schema backups;
alter table public._backup_cancel_rsz_20261116_carteira set schema backups;
alter table public._backup_cancel_rsz_20261116_pedidos set schema backups;
alter table public._backup_del_rsz_carteira set schema backups;
alter table public._backup_del_rsz_historico set schema backups;
alter table public._backup_del_rsz_notificacoes set schema backups;
alter table public._backup_del_rsz_pedidos set schema backups;
alter table public._backup_mes_zsm_20260810 set schema backups;

-- Rollback, se precisar:
--   grant insert on public.notificacoes to anon;
--   alter policy "Service can insert notifications" on public.notificacoes to public;
--   grant execute on function <mesma lista> to anon, public;
--   grant execute on function public.recalcular_totais_cliente(uuid), public.perform_health_check() to authenticated;
--   grant insert, update, delete, truncate, trigger, references on public.pedidos_resumo to authenticated;
--   alter table backups._backup_<nome> set schema public;
