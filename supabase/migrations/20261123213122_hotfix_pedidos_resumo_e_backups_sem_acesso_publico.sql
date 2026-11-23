-- Hotfix de 23/11/2026, aprovado pelo dono: fecha o acesso sem login a pedidos_resumo e as tabelas de backup.

-- 1) A visao passa a respeitar o RLS de pedidos de quem consulta, e anon perde todo acesso a ela.
alter view public.pedidos_resumo set (security_invoker = on);
revoke all on public.pedidos_resumo from anon;

-- 2) Tabelas de backup: RLS ligado (sem politicas, ninguem le pela API) e sem permissoes para anon e authenticated. Os dados ficam.
alter table public._backup_cancel_massa_20260812_carteira enable row level security;
alter table public._backup_cancel_massa_20260812_pedidos enable row level security;
alter table public._backup_cancel_rsz_20261116_carteira enable row level security;
alter table public._backup_cancel_rsz_20261116_pedidos enable row level security;
alter table public._backup_del_rsz_carteira enable row level security;
alter table public._backup_del_rsz_historico enable row level security;
alter table public._backup_del_rsz_notificacoes enable row level security;
alter table public._backup_del_rsz_pedidos enable row level security;
alter table public._backup_mes_zsm_20260810 enable row level security;

revoke all on
  public._backup_cancel_massa_20260812_carteira,
  public._backup_cancel_massa_20260812_pedidos,
  public._backup_cancel_rsz_20261116_carteira,
  public._backup_cancel_rsz_20261116_pedidos,
  public._backup_del_rsz_carteira,
  public._backup_del_rsz_historico,
  public._backup_del_rsz_notificacoes,
  public._backup_del_rsz_pedidos,
  public._backup_mes_zsm_20260810
from anon, authenticated;

-- Rollback, se precisar:
--   alter view public.pedidos_resumo set (security_invoker = off);
--   grant all on public.pedidos_resumo to anon;
--   alter table public._backup_<nome> disable row level security;
--   grant all on public._backup_<nome> to anon, authenticated;
