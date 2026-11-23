// KPIs calculados no banco (migration 20261123233919_kpis_paginas_pesadas).
//
// Antes, DashboardAdmin, PortalDashboard e GestaoMetas baixavam pedidos.*
// inteiro (78 MB de JSON, com o itens) so para somar no navegador. As funcoes
// sao SECURITY INVOKER: cada um continua vendo so o que a RLS ja deixava.
import { supabase } from '@/lib/supabase';

const dois = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' da data LOCAL (nao UTC). */
export const dataLocalISO = (d = new Date()) =>
  `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/**
 * Relogio local sem fuso ('YYYY-MM-DDTHH:mm:ss.SSS'). As datas de pedidos sao
 * timestamp sem fuso e o JS sempre as leu como hora local; para o banco fazer
 * a mesma conta, ele precisa do "agora" no mesmo referencial.
 */
export const momentoLocalISO = (d = new Date()) =>
  `${dataLocalISO(d)}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;

/**
 * Ultimo dia de vencimento que os dashboards contam como VENCIDO.
 *
 * Os dashboards faziam `new Date(t.data_vencimento) < hojeMeiaNoiteLocal`. A
 * string so-data vira meia-noite UTC, que em Brasilia e 21h do dia anterior:
 * por isso o titulo que vence hoje ja aparecia como vencido. Esta conta
 * reproduz exatamente aquela comparacao, em qualquer fuso, para os numeros nao
 * mudarem com a troca.
 */
export const corteVencimentoDashboard = (agora = new Date()) => {
  const hojeZero = new Date(agora);
  hojeZero.setHours(0, 0, 0, 0);
  return new Date(hojeZero.getTime() - 1).toISOString().slice(0, 10);
};

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
    p_corte_vencimento: corteVencimentoDashboard(),
    p_fornecedor_id: fornecedorId,
    p_comprador_user_id: compradorId,
    p_loja_id: lojaId,
    p_produtos_fornecedor_id: produtosFornecedorId,
  });

/** Graficos e listas do DashboardAdmin. */
export const kpisDashboardAdmin = (agora = new Date()) =>
  rpc('kpis_dashboard_admin', { p_hoje: dataLocalISO(agora), p_agora: momentoLocalISO(agora) });

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
