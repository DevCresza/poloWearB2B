/**
 * Divisao do pagamento de uma NF entre varias formas.
 *
 * A primeira versao disto (divisaoBoleto) assumia "cartao + boleto" e vivia no
 * fluxo do boleto. O caso real e mais simples e mais geral: o cliente paga
 * metade a vista e metade no credito, sem boleto nenhum -- e ali o campo nunca
 * aparecia. A divisao e entre QUAISQUER formas e acontece ao faturar.
 *
 * Fica em arquivo proprio porque a conta e usada em mais de uma tela. Conta de
 * dinheiro duplicada e como a NF 1199 virou cobranca de R$ 8.343,60 fora do
 * lugar: as copias divergem e ninguem percebe ate alguem pagar errado.
 */

export const METODOS = [
  { valor: 'boleto_faturado', rotulo: 'Boleto Faturado' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'cartao_credito', rotulo: 'Cartão de Crédito' },
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'a_vista', rotulo: 'À Vista' },
  { valor: 'transferencia', rotulo: 'Transferência' },
];

export const rotuloMetodo = (m) =>
  METODOS.find(x => x.valor === m)?.rotulo || m || '';

/** Formas que geram boleto, e portanto parcelas com data e arquivo. */
export const ehBoleto = (metodo) => metodo === 'boleto' || metodo === 'boleto_faturado';

/** Le "1.234,56" ou "1234.56"; lixo vira 0. */
export const valorInformado = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const emCentavos = (v) => Math.round((Number(v) || 0) * 100);

/**
 * Confere uma divisao contra o valor da nota.
 *
 * @param {Array<{metodo: string, valor: number|string}>} linhas
 * @param {number} valorNota
 *
 * Devolve { erro, linhas, somaPagamentos, valorBoleto, valorAVista }.
 * A comparacao e em CENTAVOS: em float, 8638.56 + 8638.56 !== 17277.12 e a
 * tela recusaria uma divisao correta.
 */
export function conferirDivisao(linhas, valorNota) {
  const limpas = (linhas || [])
    .map(l => ({ metodo: l.metodo, valor: valorInformado(l.valor) }))
    .filter(l => l.metodo && l.valor > 0);

  if (limpas.length === 0) {
    return { erro: 'Informe ao menos uma forma de pagamento.', linhas: [], somaPagamentos: 0, valorBoleto: 0, valorAVista: 0 };
  }

  const metodos = limpas.map(l => l.metodo);
  if (new Set(metodos).size !== metodos.length) {
    return { erro: 'A mesma forma aparece duas vezes. Some os valores numa linha só.', linhas: limpas, somaPagamentos: 0, valorBoleto: 0, valorAVista: 0 };
  }

  const soma = limpas.reduce((s, l) => s + emCentavos(l.valor), 0);
  const nota = emCentavos(valorNota);

  if (soma !== nota) {
    const dif = (soma - nota) / 100;
    return {
      erro: dif > 0
        ? `A divisão passa ${dif.toFixed(2).replace('.', ',')} do valor da nota.`
        : `Faltam ${Math.abs(dif).toFixed(2).replace('.', ',')} para fechar o valor da nota.`,
      linhas: limpas, somaPagamentos: soma / 100, valorBoleto: 0, valorAVista: 0,
    };
  }

  return {
    erro: null,
    linhas: limpas,
    somaPagamentos: soma / 100,
    // Parte que vira boleto (com parcelas, datas e arquivo) e parte que vira
    // titulo direto na carteira, sem boleto para conciliar.
    valorBoleto: limpas.filter(l => ehBoleto(l.metodo)).reduce((s, l) => s + l.valor, 0),
    valorAVista: limpas.filter(l => !ehBoleto(l.metodo)).reduce((s, l) => s + l.valor, 0),
  };
}

/**
 * Divide um valor em N parcelas de centavos inteiros, sobra nas primeiras.
 *
 * Dividir em float deixava a soma dos titulos fora do valor da nota por ate 2
 * centavos -- 22 das 200 notas em producao nasceram assim.
 */
export function parcelar(valor, qtdParcelas) {
  const parcelas = Math.max(1, parseInt(qtdParcelas, 10) || 1);
  const centavos = emCentavos(valor);
  const base = Math.floor(centavos / parcelas);
  const sobra = centavos - base * parcelas;
  return Array.from({ length: parcelas }, (_, i) => (base + (i < sobra ? 1 : 0)) / 100);
}
