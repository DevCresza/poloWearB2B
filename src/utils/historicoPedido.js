/**
 * Leitura da trilha de auditoria do pedido (tabela pedido_historico).
 *
 * O banco grava nome de coluna e valor cru -- 'valor_final', 'em_producao',
 * '2026-10-20'. Quem le e o Bruno conferindo quem cancelou um pedido, nao um
 * desenvolvedor: a traducao para portugues acontece aqui, num arquivo so, para
 * nao espalhar dicionario pela tela.
 */

const CAMPOS = {
  status: 'Status do pedido',
  status_pagamento: 'Status do pagamento',
  valor_total: 'Valor total',
  valor_final: 'Valor final',
  valor_faturado: 'Valor faturado',
  valor_quebra: 'Quebra',
  valor_frete: 'Frete',
  valor_frete_fob: 'Frete FOB',
  desconto: 'Desconto',
  itens: 'Itens do pedido',
  qtd_pecas: 'Quantidade de peças',
  endereco_entrega: 'Endereço de entrega',
  data_prevista_entrega: 'Entrega prevista',
  data_entrega_real: 'Entrega realizada',
  data_envio_real: 'Data de envio',
  transportadora: 'Transportadora',
  codigo_rastreio: 'Código de rastreio',
  link_rastreio: 'Link de rastreio',
  nota_fiscal: 'Nota fiscal',
  nf_numero: 'Número da NF',
  nf_url: 'Arquivo da NF',
  nf_data_upload: 'Envio da NF',
  boleto_url: 'Arquivo do boleto',
  boleto_data_upload: 'Envio do boleto',
  metodo_pagamento: 'Forma de pagamento',
  metodo_pagamento_original: 'Forma de pagamento original',
  data_pagamento: 'Data do pagamento',
  data_aprovacao: 'Aprovação',
  qtd_parcelas: 'Parcelas',
  parcelas_info: 'Dados das parcelas',
  observacoes: 'Observações',
  observacoes_internas: 'Observações internas',
  observacoes_comprador: 'Observações do comprador',
  observacoes_fornecedor: 'Observações do fornecedor',
  observacao_recebimento: 'Observação de recebimento',
  motivo_recusa: 'Motivo da recusa',
  impresso: 'Impresso',
  data_impressao: 'Data de impressão',
  urgente: 'Urgente',
  estoque_baixado: 'Baixa de estoque',
  cliente_confirmou_nf: 'Cliente confirmou a NF',
  cliente_confirmou_boleto: 'Cliente confirmou o boleto',
  cliente_confirmou_recebimento: 'Cliente confirmou o recebimento',
  comprovante_pagamento_url: 'Comprovante de pagamento',
  mes_referencia: 'Mês de referência',
  meses_entrega: 'Meses de entrega',
  fornecedor_id: 'Fornecedor',
  loja_id: 'Loja',
  franqueado_id: 'Franqueado',
  tipo_frete: 'Tipo de frete',
  frete_incluso_boleto: 'Frete no boleto',
  frete_modo_cobranca: 'Cobrança do frete',
  pix_info: 'Dados do PIX',
  cartao_link_pagamento: 'Link de pagamento',
  itens_revisados_em: 'Revisão dos itens',
};

const STATUS = {
  novo_pedido: 'Novo pedido',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  em_producao: 'Em produção',
  parcialmente_faturado: 'Parcialmente faturado',
  faturado: 'Faturado',
  em_transporte: 'Em transporte',
  pendente_pagamento: 'Aguardando pagamento',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
};

const PAPEIS = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  cadastro: 'Cadastro',
  fornecedor: 'Fornecedor',
  multimarca: 'Multimarca',
  franqueado: 'Franqueado',
  // app_role() volta nulo fora de uma sessao de aplicacao; o trigger marca a
  // origem para nao confundir "rodou por fora" com "autor desconhecido".
  service_role: 'Sistema',
};

/** Campos cujo de/para o trigger nao guarda: so sabemos que mudaram. */
export const SEM_DETALHE = ['itens', 'endereco_entrega', 'parcelas_info'];

export const rotuloCampo = (campo) => CAMPOS[campo] || campo;
export const rotuloStatus = (valor) => STATUS[valor] || valor || '—';
export const rotuloPapel = (papel) => PAPEIS[papel] || papel || '';

const ehDinheiro = (campo) => /^(valor|desconto)/.test(campo);
const ehData = (campo) => /^(data|.*_em|.*_data_upload|itens_revisados_em)/.test(campo);

/** Formata um valor cru do banco para leitura humana, conforme o campo. */
export function formatarValor(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (campo === 'status' || campo === 'status_pagamento') return rotuloStatus(valor);

  if (ehDinheiro(campo)) {
    const n = Number(valor);
    if (Number.isFinite(n)) {
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
  }

  if (ehData(campo) && typeof valor === 'string') {
    const d = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  }

  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'object') return 'alterado';

  const texto = String(valor);
  return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto;
}

/** Identifica quem fez a mudança, com o papel entre parenteses. */
export function autorDaLinha(linha) {
  const papel = rotuloPapel(linha?.autor_papel);
  if (linha?.autor_papel === 'service_role') return 'Sistema';
  const quem = linha?.autor_email || 'Autor não identificado';
  return papel ? `${quem} (${papel})` : quem;
}

/**
 * Uma frase para o topo da linha do tempo. Mudança de status ganha frase
 * propria porque e a pergunta que origina a consulta ("quem cancelou?");
 * o resto vira a contagem de campos, detalhada logo abaixo.
 */
export function resumoDaLinha(linha) {
  if (!linha) return '';
  if (linha.acao === 'criado') return 'Pedido criado';
  if (linha.acao === 'apagado') return 'Pedido apagado';

  if (linha.status_de !== linha.status_para) {
    return `${rotuloStatus(linha.status_de)} → ${rotuloStatus(linha.status_para)}`;
  }

  const n = (linha.campos || []).length;
  if (n === 1) return `Alterou ${rotuloCampo(linha.campos[0]).toLowerCase()}`;
  return `Alterou ${n} campos`;
}

/** Linhas de detalhe (de → para) de uma entrada, já formatadas. */
export function detalhesDaLinha(linha) {
  const mudancas = linha?.mudancas || {};
  const comDetalhe = Object.keys(mudancas).map(campo => ({
    campo,
    rotulo: rotuloCampo(campo),
    de: formatarValor(campo, mudancas[campo]?.de),
    para: formatarValor(campo, mudancas[campo]?.para),
  }));

  // Colunas volumosas: o trigger guarda o nome, nao o conteudo.
  const semDetalhe = (linha?.campos || [])
    .filter(c => SEM_DETALHE.includes(c))
    .map(campo => ({ campo, rotulo: rotuloCampo(campo), de: null, para: null }));

  return [...comDetalhe, ...semDetalhe].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}
