-- T8: o front pergunta se o estoque do pedido ja e automatico no banco.
--
-- Enquanto a fase 2 (trigger trg_pedidos_zz_estoque) nao estiver ligada, as
-- telas seguem devolvendo/baixando estoque como antes ao cancelar ou revisar
-- itens; depois de ligada, deixam isso so para o banco. Assim o deploy do
-- front e a fase 2 podem ir ao ar em qualquer ordem sem estorno em dobro nem
-- janela sem estorno -- e desligar o trigger (rollback) volta o front ao
-- caminho antigo sozinho.
--
-- Rollback: revoke execute on function public.estoque_automatico_ativo() from authenticated;
--           (e remover a funcao)

create or replace function public.estoque_automatico_ativo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from pg_trigger
     where tgrelid = 'public.pedidos'::regclass
       and tgname = 'trg_pedidos_zz_estoque'
       and tgenabled <> 'D'
  )
$$;

revoke all on function public.estoque_automatico_ativo() from public, anon;
grant execute on function public.estoque_automatico_ativo() to authenticated;
