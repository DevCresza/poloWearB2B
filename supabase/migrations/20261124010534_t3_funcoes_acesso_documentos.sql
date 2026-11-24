-- T3 (diagnóstico A2), parte 1 de 2: regras de acesso aos documentos.
--
-- Só cria funções e a foto das referências dos arquivos antigos. Não muda
-- nenhuma policy, bucket ou dado: pode ser aplicada antes do merge do front.
-- Precisa existir ANTES do sendEmail v11 (que chama documento_acessivel para
-- assinar links de e-mail) e da parte 2 (20261124011322_t3_storage_escrita_por_dono).
--
-- ROLLBACK: nada usa estas funções até a parte 2 e o sendEmail v11. Para
-- remover: drop function public.pode_escrever_produtos_storage(text),
-- public.pode_escrever_documento(text), public.pode_ler_documento(text),
-- public.documento_acessivel(text, uuid), interno.popular_documentos_legado();
-- drop table interno.documentos_legado; drop schema interno.

-- ---------------------------------------------------------------------------
-- 1. Arquivos antigos (uploads/): quem lê cada um, pelo que o banco referencia
-- ---------------------------------------------------------------------------
-- Foto fixa das referências (pedidos, carteira, faturamentos). Fixa de
-- propósito: se a leitura olhasse as colunas na hora, um cliente podia apontar
-- o comprovante_url do próprio título para o boleto de outro e ganhar leitura.
-- Arquivo novo vai para pasta por dono e não precisa desta tabela.

create schema if not exists interno;
revoke all on schema interno from public, anon, authenticated;
grant usage on schema interno to service_role;

create table if not exists interno.documentos_legado (
  nome            text not null,
  fornecedor_id   uuid,
  cliente_user_id uuid
);
create unique index if not exists documentos_legado_uniq
  on interno.documentos_legado (nome, fornecedor_id, cliente_user_id) nulls not distinct;
alter table interno.documentos_legado enable row level security;
revoke all on interno.documentos_legado from public, anon, authenticated;

create or replace function interno.popular_documentos_legado()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with refs(url, fornecedor_id, cliente_user_id) as (
    select u, p.fornecedor_id, p.comprador_user_id
      from public.pedidos p,
           unnest(array[p.nf_url, p.boleto_url, p.comprovante_pagamento_url]) u
    union all
    -- 80% dos títulos têm carteira.fornecedor_id nulo: o fornecedor é o do pedido.
    select u, coalesce(c.fornecedor_id, p.fornecedor_id), c.cliente_user_id
      from public.carteira c
      left join public.pedidos p on p.id = c.pedido_id,
           unnest(array[c.boleto_url, c.comprovante_url]) u
    union all
    select u, p.fornecedor_id, p.comprador_user_id
      from public.faturamentos f
      join public.pedidos p on p.id = f.pedido_id,
           unnest(array[f.nf_url, f.boleto_url]
                  || coalesce(array(
                       select a->>'url'
                         from jsonb_array_elements(
                                case when jsonb_typeof(f.nf_arquivos) = 'array'
                                     then f.nf_arquivos else '[]'::jsonb end) a),
                     '{}'::text[])) u
  ), nomes as (
    select distinct
           split_part(split_part(url, '/storage/v1/object/public/documentos/', 2), '?', 1) as nome,
           fornecedor_id, cliente_user_id
      from refs
     where url like '%/storage/v1/object/public/documentos/uploads/%'
  )
  insert into interno.documentos_legado (nome, fornecedor_id, cliente_user_id)
  select nome, fornecedor_id, cliente_user_id from nomes where nome <> ''
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function interno.popular_documentos_legado() from public, anon, authenticated;

select interno.popular_documentos_legado();

-- ---------------------------------------------------------------------------
-- 2. Regras de acesso
-- ---------------------------------------------------------------------------

-- Pode ler o documento? Fonte única: usada pela policy de leitura (via
-- pode_ler_documento) e pelo sendEmail, que assina links de e-mail com a
-- service role em nome de quem envia.
create or replace function public.documento_acessivel(p_nome text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with u as (
    select role::text as role, fornecedor_id
      from public.users
     where id = p_user and coalesce(ativo, true)
  ), a as (
    select (storage.foldername(p_nome))[1] as tipo,
           case when (storage.foldername(p_nome))[2]
                     ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then ((storage.foldername(p_nome))[2])::uuid end as dono,
           '/storage/v1/object/public/documentos/' || p_nome as suf
  )
  select coalesce((
    select case
      -- staff que vê pedidos
      when u.role in ('admin', 'vendedor') then true
      -- a própria pasta
      when a.tipo = 'fornecedor' and u.role = 'fornecedor' and a.dono = u.fornecedor_id then true
      when a.tipo = 'cliente' and a.dono = p_user then true
      -- cliente lendo NF/boleto do fornecedor de um pedido seu
      when a.tipo = 'fornecedor' then
           exists (select 1 from public.pedidos p
                    where p.comprador_user_id = p_user and p.fornecedor_id = a.dono
                      and (right(p.nf_url, length(a.suf)) = a.suf
                        or right(p.boleto_url, length(a.suf)) = a.suf))
        or exists (select 1 from public.carteira c
                     left join public.pedidos p on p.id = c.pedido_id
                    where c.cliente_user_id = p_user
                      and coalesce(c.fornecedor_id, p.fornecedor_id) = a.dono
                      and right(c.boleto_url, length(a.suf)) = a.suf)
        or exists (select 1 from public.faturamentos f
                     join public.pedidos p on p.id = f.pedido_id
                    where p.comprador_user_id = p_user and p.fornecedor_id = a.dono
                      and (right(f.nf_url, length(a.suf)) = a.suf
                        or right(f.boleto_url, length(a.suf)) = a.suf
                        or (jsonb_typeof(f.nf_arquivos) = 'array' and exists (
                              select 1 from jsonb_array_elements(f.nf_arquivos) x
                               where right(x->>'url', length(a.suf)) = a.suf))))
      -- fornecedor lendo comprovante do cliente de um pedido seu
      when a.tipo = 'cliente' and u.role = 'fornecedor' then
           exists (select 1 from public.carteira c
                     left join public.pedidos p on p.id = c.pedido_id
                    where c.cliente_user_id = a.dono
                      and coalesce(c.fornecedor_id, p.fornecedor_id) = u.fornecedor_id
                      and right(c.comprovante_url, length(a.suf)) = a.suf)
        or exists (select 1 from public.pedidos p
                    where p.comprador_user_id = a.dono and p.fornecedor_id = u.fornecedor_id
                      and right(p.comprovante_pagamento_url, length(a.suf)) = a.suf)
      -- arquivos antigos: pela foto das referências, ou quem subiu
      when a.tipo = 'uploads' then
           exists (select 1 from interno.documentos_legado l
                    where l.nome = p_nome
                      and (l.cliente_user_id = p_user
                        or (u.role = 'fornecedor' and l.fornecedor_id = u.fornecedor_id)))
        or exists (select 1 from storage.objects o
                    where o.bucket_id = 'documentos' and o.name = p_nome
                      and o.owner_id = p_user::text)
      else false
    end
    from u, a), false)
$$;
revoke all on function public.documento_acessivel(text, uuid) from public, anon, authenticated;
grant execute on function public.documento_acessivel(text, uuid) to service_role;

create or replace function public.pode_ler_documento(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select public.documento_acessivel(p_nome, auth.uid()) $$;

create or replace function public.pode_escrever_documento(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(case
    when public.ve_todos_pedidos() then true
    when (storage.foldername(p_nome))[1] = 'fornecedor' then
         public.app_role() = 'fornecedor'
         and (storage.foldername(p_nome))[2] = public.meu_fornecedor_id()::text
    when (storage.foldername(p_nome))[1] = 'cliente' then
         (storage.foldername(p_nome))[2] = auth.uid()::text
    else false
  end, false)
$$;

create or replace function public.pode_escrever_produtos_storage(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(case (storage.foldername(p_nome))[1]
    when 'banners'  then public.is_admin()
    when 'recursos' then public.is_admin()
    when 'avatars'  then public.is_admin()
                         or (storage.foldername(p_nome))[2] = auth.uid()::text
    else public.pode_gerir_catalogo()
  end, false)
$$;

revoke all on function public.pode_ler_documento(text) from public, anon;
revoke all on function public.pode_escrever_documento(text) from public, anon;
revoke all on function public.pode_escrever_produtos_storage(text) from public, anon;
grant execute on function public.pode_ler_documento(text) to authenticated, service_role;
grant execute on function public.pode_escrever_documento(text) to authenticated, service_role;
grant execute on function public.pode_escrever_produtos_storage(text) to authenticated, service_role;

