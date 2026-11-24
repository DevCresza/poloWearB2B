import { supabase } from '@/lib/supabase';

// Quais produtos/cápsulas já aparecem em algum pedido. Esses não podem ser
// excluídos (o banco recusa, trigger *_bloqueia_excluir_com_pedido): a tela
// troca "Excluir" por "Arquivar". O cadastro não lê pedidos pela RLS, então a
// conta vem de uma função do banco (produtos_com_pedidos / capsulas_com_pedidos).
//
// Em caso de erro devolve null: a tela trata como "não sei" e mantém só o
// Arquivar (o banco continua recusando a exclusão de quem tem pedido).
async function idsComPedidos(funcao, ids) {
  const lista = (ids || []).filter(Boolean);
  if (lista.length === 0) return new Set();
  const { data, error } = await supabase.rpc(funcao, { p_ids: lista });
  if (error) {
    console.error(`Erro em ${funcao}:`, error);
    return null;
  }
  return new Set((data || []).map((linha) => (typeof linha === 'string' ? linha : Object.values(linha)[0])));
}

export const produtosComPedidos = (ids) => idsComPedidos('produtos_com_pedidos', ids);
export const capsulasComPedidos = (ids) => idsComPedidos('capsulas_com_pedidos', ids);
