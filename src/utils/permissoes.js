/**
 * Permissoes — o que cada papel pode fazer.
 *
 * A coluna `users.permissoes` (jsonb) ja existia, era gravada pelos formularios
 * e exibida em MeuPerfil, mas NUNCA era lida para autorizar nada: era decoracao.
 * Pior, o vocabulario divergia entre arquivos (userCreationHelper gravava
 * `gerenciar_produtos`, UserFormAdmin gravava `cadastrar_produtos`/`editar_produtos`).
 *
 * Agora a permissao e DERIVADA DO PAPEL, e nao editavel caso a caso — senao a
 * bagunca se recria. `users.permissoes` continua no banco por compatibilidade,
 * mas nao manda em nada.
 */

import { PAPEIS, getPapel } from './roles';

export const PERM = {
  // Navegacao basica
  VER_DASHBOARD: 'ver_dashboard',
  VER_RECURSOS: 'ver_recursos',

  // Compra
  VER_CATALOGO: 'ver_catalogo',
  VER_CAPSULAS: 'ver_capsulas',
  FAZER_PEDIDOS: 'fazer_pedidos',
  VENDER_PARA_CLIENTE: 'vender_para_cliente', // fechar pedido em nome de um cliente
  VER_MEUS_PEDIDOS: 'ver_meus_pedidos',

  // Pedidos (staff)
  VER_TODOS_PEDIDOS: 'ver_todos_pedidos',       // PedidosAdmin
  VER_PEDIDOS_FORNECEDOR: 'ver_pedidos_fornecedor', // PedidosFornecedor
  GERENCIAR_PEDIDOS: 'gerenciar_pedidos',
  EMITIR_LOTE: 'emitir_lote',

  // Dinheiro — o "topo" que o vendedor nao pode ver
  VER_TOTAIS_FATURAMENTO: 'ver_totais_faturamento',
  VER_PRECOS_CUSTO: 'ver_precos_custo',
  VER_CARTEIRA: 'ver_carteira',
  VER_RELATORIOS: 'ver_relatorios',
  EXPORTAR_DADOS: 'exportar_dados',

  // Cadastro
  CADASTRAR_PRODUTOS: 'cadastrar_produtos',
  EDITAR_PRODUTOS: 'editar_produtos',
  GERENCIAR_CAPSULAS: 'gerenciar_capsulas',
  GERENCIAR_ESTOQUE: 'gerenciar_estoque',

  // Gestao
  GERENCIAR_USUARIOS: 'gerenciar_usuarios',
  GERENCIAR_CLIENTES: 'gerenciar_clientes',
  GERENCIAR_FORNECEDORES: 'gerenciar_fornecedores',
  VER_CRM: 'ver_crm',
  VER_METAS: 'ver_metas',
  CONFIG_SISTEMA: 'config_sistema',
};

const TODAS = Object.values(PERM);

const CLIENTE = [
  PERM.VER_DASHBOARD, PERM.VER_RECURSOS,
  PERM.VER_CATALOGO, PERM.VER_CAPSULAS, PERM.FAZER_PEDIDOS, PERM.VER_MEUS_PEDIDOS,
  PERM.VER_CARTEIRA,
];

export const PERMISSOES_POR_PAPEL = {
  // Acesso geral.
  [PAPEIS.ADMIN]: TODAS,

  // Ve o catalogo/capsulas como as lojas veem (so ativos) e fecha pedido em nome
  // do cliente. Ve os pedidos de todos, mas NAO os totais de faturamento nem custo.
  [PAPEIS.VENDEDOR]: [
    PERM.VER_DASHBOARD, PERM.VER_RECURSOS,
    PERM.VER_CATALOGO, PERM.VER_CAPSULAS,
    PERM.FAZER_PEDIDOS, PERM.VENDER_PARA_CLIENTE,
    PERM.VER_TODOS_PEDIDOS,
  ],

  // Cria/edita/ativa produtos e capsulas — incluindo precos. Nao ve pedidos
  // nem faturamento.
  [PAPEIS.CADASTRO]: [
    PERM.VER_DASHBOARD, PERM.VER_RECURSOS,
    PERM.VER_CATALOGO, PERM.VER_CAPSULAS,
    PERM.CADASTRAR_PRODUTOS, PERM.EDITAR_PRODUTOS,
    PERM.GERENCIAR_CAPSULAS,
    PERM.VER_PRECOS_CUSTO, // edita preco, entao ve os campos de preco do produto
  ],

  // Mantem o que o fornecedor ja tinha. Nota: ele NAO tem VER_TODOS_PEDIDOS —
  // hoje o guard de PedidosAdmin o deixava entrar e ver o total geral de TODOS
  // os pedidos do sistema. O lugar dele e PedidosFornecedor, que filtra pelos
  // pedidos dele.
  [PAPEIS.FORNECEDOR]: [
    PERM.VER_DASHBOARD, PERM.VER_RECURSOS,
    PERM.VER_PEDIDOS_FORNECEDOR, PERM.GERENCIAR_PEDIDOS,
    PERM.CADASTRAR_PRODUTOS, PERM.EDITAR_PRODUTOS,
    PERM.GERENCIAR_CAPSULAS, PERM.GERENCIAR_ESTOQUE,
    PERM.VER_PRECOS_CUSTO, PERM.VER_CARTEIRA,
    PERM.VER_TOTAIS_FATURAMENTO, PERM.EXPORTAR_DADOS,
  ],

  [PAPEIS.MULTIMARCA]: CLIENTE,
  [PAPEIS.FRANQUEADO]: CLIENTE,
};

/** O usuario tem a permissao? */
export function can(user, permissao) {
  const papel = getPapel(user);
  if (!papel) return false;
  const lista = PERMISSOES_POR_PAPEL[papel];
  if (!lista) return false; // papel desconhecido => nega (era fail-open antes)
  return lista.includes(permissao);
}

/**
 * Permissao exigida por pagina. Consumido por ProtectedRoute.
 * `null` = basta estar autenticado.
 *
 * As 7 paginas que nao tinham guarda nenhuma (DashboardAdmin, GestaoClientes,
 * GestaoFornecedores, GestaoMetas, CrmDashboard, ConfigWhatsApp, Admin) entram
 * aqui — antes, qualquer cliente logado abria pela URL.
 */
export const PERMISSAO_POR_PAGINA = {
  PortalDashboard: PERM.VER_DASHBOARD,
  MeuPerfil: null,
  Recursos: PERM.VER_RECURSOS,

  Catalogo: PERM.VER_CATALOGO,
  Carrinho: PERM.FAZER_PEDIDOS,
  MeusPedidos: PERM.VER_MEUS_PEDIDOS,
  CarteiraFinanceira: PERM.VER_CARTEIRA,
  HistoricoCompras: PERM.VER_CARTEIRA,

  PedidosAdmin: PERM.VER_TODOS_PEDIDOS,
  PedidosFornecedor: PERM.VER_PEDIDOS_FORNECEDOR,
  EmissaoLote: PERM.EMITIR_LOTE,
  HistoricoEmails: PERM.GERENCIAR_PEDIDOS,

  GestaoProdutos: PERM.EDITAR_PRODUTOS,
  GestaoCapsulas: PERM.GERENCIAR_CAPSULAS,
  GestaoEstoque: PERM.GERENCIAR_ESTOQUE,

  DashboardAdmin: PERM.VER_RELATORIOS,
  Admin: PERM.CONFIG_SISTEMA,
  ConfigWhatsApp: PERM.CONFIG_SISTEMA,
  UserManagement: PERM.GERENCIAR_USUARIOS,
  GestaoClientes: PERM.GERENCIAR_CLIENTES,
  GestaoFornecedores: PERM.GERENCIAR_FORNECEDORES,
  CrmDashboard: PERM.VER_CRM,
  GestaoMetas: PERM.VER_METAS,
};
