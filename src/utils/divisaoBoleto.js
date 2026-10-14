/**
 * Divisao do valor de uma NF entre cartao e boleto, e do boleto entre parcelas.
 *
 * Existe em arquivo proprio porque DUAS telas fazem a mesma conta -- o modal
 * "Boleto por NF" do fornecedor e o boleto por faturamento do admin. Conta de
 * dinheiro duplicada e como a NF 1199 virou uma cobranca de R$ 8.343,60 fora
 * do lugar: as copias divergem e ninguem percebe ate alguem pagar errado.
 */

/** Le "1.234,56" ou "1234.56" e devolve numero; lixo vira 0. */
export const valorInformado = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * @param {number} valorNota     valor cheio da NF
 * @param {number} valorCartao   quanto sai no cartao (0 = tudo no boleto)
 * @param {number} qtdParcelas   em quantas parcelas o boleto se divide
 *
 * Devolve:
 *   erro            mensagem quando a divisao nao faz sentido, senao null
 *   valorBoleto     o que sobra para o boleto
 *   totalTitulos    parcelas do boleto + 1 se houver cartao. O cartao entra
 *                   como o ULTIMO titulo: o indice unico
 *                   (faturamento_id, parcela_numero) nao aceita numero
 *                   repetido, e ele precisa de parcela_numero para contar como
 *                   divida real -- total_em_aberto ignora linha sem ele.
 *   valorDaParcela  (i) => valor da parcela i do boleto
 *
 * As parcelas sao divididas em CENTAVOS inteiros, com a sobra espalhada nas
 * primeiras. Dividir em float deixava a soma dos titulos fora do valor da nota
 * por ate 2 centavos -- 22 das 200 notas em producao nasceram assim.
 */
export function dividirBoleto(valorNota, valorCartao, qtdParcelas) {
  const nota = Number(valorNota) || 0;
  const cartao = Math.max(0, Number(valorCartao) || 0);
  const parcelas = Math.max(1, parseInt(qtdParcelas, 10) || 1);

  if (cartao > 0 && cartao >= nota) {
    return {
      erro: 'A parte no cartão tem que ser menor que o valor da nota. Se for tudo no cartão, troque a forma de pagamento em vez de dividir.',
      valorCartao: cartao,
      valorBoleto: 0,
      totalTitulos: 0,
      valorDaParcela: () => 0,
    };
  }

  const valorBoleto = nota - cartao;
  const centavos = Math.round(valorBoleto * 100);
  const base = Math.floor(centavos / parcelas);
  const sobra = centavos - base * parcelas;

  return {
    erro: null,
    valorCartao: cartao,
    valorBoleto,
    totalTitulos: parcelas + (cartao > 0 ? 1 : 0),
    valorDaParcela: (i) => (base + (i < sobra ? 1 : 0)) / 100,
  };
}
