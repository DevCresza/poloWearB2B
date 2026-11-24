// KPIs calculados no banco (migration 20261123233919_kpis_paginas_pesadas).
//
// Antes, DashboardAdmin, PortalDashboard e GestaoMetas baixavam pedidos.*
// inteiro (78 MB de JSON, com o itens) so para somar no navegador. As funcoes
// sao SECURITY INVOKER: cada um continua vendo so o que a RLS ja deixava.
import { supabase } from '@/lib/supabase';
import { hojeBR, agoraUTCsemFuso } from '@/utils/dataBR';

// Vencido = data_vencimento < hoje (Brasilia). O titulo que vence hoje NAO
// e vencido, e titulo sem data vai a parte (carteira.sem_vencimento). Ate a
// T15 os paineis contavam os dois como vencidos.

const rpc = async (nome, params) => {
  const { data, error } = await supabase.rpc(nome, params);
  if (error) throw new Error(`Erro em ${nome}: ${error.message}`);
  return data;
};

/**
 * Cards padronizados (pedidos por status, carteira pendente, produtos).
 * Filtros opcionais: os mesmos que as telas passavam ao list() antigo.
 */
export const kpisDashboard = ({ fornecedorId = null, compradorId = null, lojaId = null, produtosFornecedorId = null } = {}) =>
  rpc('kpis_dashboard', {
    p_corte_vencimento: hojeBR(),
    p_fornecedor_id: fornecedorId,
    p_comprador_user_id: compradorId,
    p_loja_id: lojaId,
    p_produtos_fornecedor_id: produtosFornecedorId,
  });

/**
 * Graficos e listas do DashboardAdmin. p_hoje e o dia em Brasilia; p_agora e
 * o agora em UTC sem fuso, o mesmo referencial das colunas do banco.
 */
export const kpisDashboardAdmin = () =>
  rpc('kpis_dashboard_admin', { p_hoje: hojeBR(), p_agora: agoraUTCsemFuso() });

/** Realizado (valor e pecas) de todas as metas de um mes. */
export const metasRealizado = (ano, mes) =>
  rpc('metas_realizado', { p_ano: ano, p_mes: mes });

/**
 * Acesso por status ao resultado de kpis_dashboard.
 * soma(['faturado', ...], 'valor_faturado'), qtd([...]), statuses() etc.
 */
export const porStatus = (kpis) => {
  const mapa = {};
  (kpis?.por_status || []).forEach((s) => { mapa[s.status] = s; });
  const todos = Object.keys(mapa);
  const lista = (sts) => (sts === '*' ? todos : sts);
  return {
    mapa,
    todos,
    qtd: (sts) => lista(sts).reduce((acc, st) => acc + (Number(mapa[st]?.qtd) || 0), 0),
    soma: (sts, campo) => lista(sts).reduce((acc, st) => acc + (Number(mapa[st]?.[campo]) || 0), 0),
    exceto: (st) => todos.filter((s) => s !== st),
  };
};
