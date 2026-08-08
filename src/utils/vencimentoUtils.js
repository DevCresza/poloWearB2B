// Validacao das datas de vencimento digitadas ao gerar boleto/parcelas.
//
// As datas vem de <input type="date">, onde um deslize de digitacao passa
// despercebido: ja aconteceu de virar "0206-12-03" (ano 206) e de "2027-01-02"
// virar "2026-01-02". Um titulo com vencimento no passado nasce vencido e
// marca o cliente como inadimplente na hora do faturamento.

const ANO_MIN = 2020;
const ANO_MAX = 2100;

const paraData = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const hojeLocal = () => {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
};

/**
 * Valida uma lista de datas 'YYYY-MM-DD' de vencimento de parcelas.
 *
 * `erro` bloqueia o envio (data impossivel de ser intencional).
 * `aviso` so pede confirmacao — boleto lancado com atraso e legitimo.
 */
export const validarVencimentos = (datas = []) => {
  const lista = (datas || []).filter(Boolean);
  if (lista.length === 0) return { ok: true, erro: null, aviso: null };

  for (let i = 0; i < lista.length; i++) {
    const data = paraData(lista[i]);
    if (!data) {
      return { ok: false, erro: `A data da parcela ${i + 1} é inválida.`, aviso: null };
    }
    const ano = data.getFullYear();
    if (ano < ANO_MIN || ano > ANO_MAX) {
      return {
        ok: false,
        erro: `O ano do vencimento da parcela ${i + 1} (${ano}) parece errado. Confira a data.`,
        aviso: null
      };
    }
  }

  // Parcelamento tem que ser crescente: 1ª antes da 2ª, e por aí vai.
  // É este teste que pega o ano digitado errado na virada (dez/2026 → jan/2026).
  for (let i = 1; i < lista.length; i++) {
    const anterior = paraData(lista[i - 1]);
    const atual = paraData(lista[i]);
    if (anterior && atual && atual <= anterior) {
      return {
        ok: false,
        erro: `O vencimento da parcela ${i + 1} (${atual.toLocaleDateString('pt-BR')}) não é posterior `
          + `ao da parcela ${i} (${anterior.toLocaleDateString('pt-BR')}). Confira o mês e o ano.`,
        aviso: null
      };
    }
  }

  const vencidas = lista.filter(iso => {
    const d = paraData(iso);
    return d && d < hojeLocal();
  });
  if (vencidas.length > 0) {
    return {
      ok: true,
      erro: null,
      aviso: `${vencidas.length} parcela(s) com vencimento no passado. `
        + 'O título já nasce vencido e o cliente aparece como inadimplente. Confirmar mesmo assim?'
    };
  }

  return { ok: true, erro: null, aviso: null };
};
