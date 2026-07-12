-- =====================================================================
-- Baixa de estoque no servidor.
--
-- O checkout do CLIENTE chamava Produto.update() direto do navegador
-- (estoqueUtils.darBaixaEstoque). Com RLS, isso obrigaria a dar UPDATE em
-- `produtos` para clientes — e `variantes_cor` carrega os PRECOS de cada
-- variante. Ou seja: qualquer cliente poderia reescrever a tabela de precos.
--
-- Esta funcao aplica SO o estoque. Precos e o resto do produto vem sempre do
-- banco, nunca do payload do cliente. A regra "so pronta entrega que controla
-- estoque" tambem passou a viver aqui (antes so o JS filtrava).
-- =====================================================================
create or replace function public.aplicar_baixa_estoque(itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item        jsonb;
  v_produto   public.produtos%rowtype;
  v_qtd       numeric;
  v_tam       text;
  v_mapa      jsonb;
  v_variantes jsonb;
  v_variante  jsonb;
  v_novas     jsonb;
  v_cor_id    text;
  v_cor_nome  text;
  v_total     numeric;
begin
  if auth.uid() is null then
    raise exception 'Nao autenticado';
  end if;

  for item in select * from jsonb_array_elements(coalesce(itens, '[]'::jsonb))
  loop
    select * into v_produto from public.produtos where id = (item->>'produto_id')::uuid;
    continue when not found;

    continue when not coalesce(v_produto.controla_estoque, false);
    continue when coalesce(v_produto.disponibilidade, '') <> 'pronta_entrega';

    v_qtd := coalesce((item->>'quantidade')::numeric, 0);
    continue when v_qtd <= 0;

    if coalesce(v_produto.venda_por_tamanho, false) then
      v_tam := item->>'tamanho_selecionado';
      continue when v_tam is null;

      v_mapa := coalesce(v_produto.estoque_por_tamanho, '{}'::jsonb);
      v_mapa := jsonb_set(
        v_mapa,
        array[v_tam],
        to_jsonb(greatest(0, coalesce((v_mapa->>v_tam)::numeric, 0) - v_qtd))
      );

      select coalesce(sum(value::numeric), 0) into v_total from jsonb_each_text(v_mapa);

      update public.produtos
         set estoque_por_tamanho = v_mapa,
             estoque_atual_grades = v_total
       where id = v_produto.id;

    elsif coalesce(v_produto.tem_variantes_cor, false) then
      v_variantes := coalesce(v_produto.variantes_cor, '[]'::jsonb);
      v_cor_id   := item#>>'{cor_selecionada,id}';
      v_cor_nome := item#>>'{cor_selecionada,cor_nome}';
      v_novas := '[]'::jsonb;

      -- Preserva a variante inteira (fotos, hex, e PRECOS); mexe so no estoque.
      for v_variante in select * from jsonb_array_elements(v_variantes)
      loop
        if (v_cor_id is not null and v_variante->>'id' = v_cor_id)
           or (v_cor_id is null and v_cor_nome is not null and v_variante->>'cor_nome' = v_cor_nome) then
          v_variante := jsonb_set(
            v_variante,
            '{estoque_grades}',
            to_jsonb(greatest(0, coalesce((v_variante->>'estoque_grades')::numeric, 0) - v_qtd))
          );
        end if;
        v_novas := v_novas || jsonb_build_array(v_variante);
      end loop;

      select coalesce(sum(coalesce((v->>'estoque_grades')::numeric, 0)), 0) into v_total
      from jsonb_array_elements(v_novas) v;

      update public.produtos
         set variantes_cor = v_novas,
             estoque_atual_grades = v_total
       where id = v_produto.id;

    else
      update public.produtos
         set estoque_atual_grades = greatest(0, coalesce(v_produto.estoque_atual_grades, 0) - v_qtd)
       where id = v_produto.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.aplicar_baixa_estoque(jsonb) from public, anon;
grant execute on function public.aplicar_baixa_estoque(jsonb) to authenticated;
