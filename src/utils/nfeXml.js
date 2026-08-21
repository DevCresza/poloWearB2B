/**
 * Leitura do XML da NF-e no faturamento do fornecedor.
 *
 * O XML ja era anexado no modal "Faturar Pedido", mas ia direto pro storage sem
 * ninguem abrir: o fornecedor redigitava numero e data da nota e marcava item por
 * item os 30+ produtos do pedido. Aqui o arquivo passa a ser lido.
 *
 * Duas particularidades do dado deste projeto guiam o casamento:
 *
 * 1. 94% dos itens sao `tipo_venda = 'grade'`. A NF conta PECAS; o pedido conta
 *    GRADES. Sem dividir por `total_pecas_grade` o faturamento sairia 6x maior.
 * 2. A mesma referencia se repete em cores diferentes (num pedido tipico da ART
 *    LIVRE, 58 linhas para 37 referencias). Casar so por `cProd` e ambiguo na
 *    maioria das linhas — a cor precisa desempatar.
 *
 * O que nao casar com seguranca fica DE FORA da selecao e volta no resumo, para
 * o fornecedor resolver na mao. Errar calado aqui grava faturamento errado.
 */

/**
 * Caixa alta, sem acento, sem pontuacao, espaco unico.
 * As cores vem do banco com espaco sobrando ("MARINHO ") e as descricoes da NF
 * usam acentuacao propria, entao comparar cru nao casa quase nada.
 */
export const normalizar = (v) => String(v ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim();

/**
 * Chave de referencia. "034415" e "34415" sao o mesmo produto para o fornecedor,
 * entao referencia puramente numerica perde o zero a esquerda.
 */
export const chaveRef = (v) => {
  const n = normalizar(v).replace(/\s+/g, '');
  if (!n) return '';
  return /^\d+$/.test(n) ? String(parseInt(n, 10)) : n;
};

// getElementsByTagNameNS('*', ...) ignora o namespace da NF-e e o prefixo, que
// variam entre emissores. querySelector tropeca nos dois.
const filhoTexto = (el, tag) => {
  if (!el) return '';
  const achado = el.getElementsByTagNameNS('*', tag)[0];
  return achado ? (achado.textContent || '').trim() : '';
};

const numero = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Le o XML de uma NF-e (com ou sem o envelope nfeProc).
 * Lanca Error com mensagem em portugues quando o arquivo nao serve.
 */
export function parseNFeXml(conteudo) {
  const doc = new DOMParser().parseFromString(conteudo, 'application/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  const infNFe = doc.getElementsByTagNameNS('*', 'infNFe')[0];
  if (!infNFe) {
    throw new Error('Este XML não é uma NF-e (não contém infNFe).');
  }

  const ide = infNFe.getElementsByTagNameNS('*', 'ide')[0];
  // dhEmi (NF-e 4.00) ja vem no fuso local (-03:00); dEmi (3.10) e data pura.
  // Nos dois casos os 10 primeiros caracteres sao a data correta -- converter
  // para Date faria a nota emitida de madrugada retroceder um dia.
  const emissao = (filhoTexto(ide, 'dhEmi') || filhoTexto(ide, 'dEmi')).slice(0, 10);

  const transp = infNFe.getElementsByTagNameNS('*', 'transp')[0];
  const transporta = transp ? transp.getElementsByTagNameNS('*', 'transporta')[0] : null;

  const itens = Array.from(infNFe.getElementsByTagNameNS('*', 'det')).map((det) => {
    const prod = det.getElementsByTagNameNS('*', 'prod')[0];
    return {
      nItem: det.getAttribute('nItem') || '',
      cProd: filhoTexto(prod, 'cProd'),
      xProd: filhoTexto(prod, 'xProd'),
      qCom: numero(filhoTexto(prod, 'qCom')),
      vUnCom: numero(filhoTexto(prod, 'vUnCom')),
      vProd: numero(filhoTexto(prod, 'vProd')),
    };
  });

  if (itens.length === 0) {
    throw new Error('A NF-e não tem itens (nenhuma tag det).');
  }

  return {
    numero: filhoTexto(ide, 'nNF'),
    serie: filhoTexto(ide, 'serie'),
    chave: (infNFe.getAttribute('Id') || '').replace(/^NFe/i, ''),
    dataEmissao: /^\d{4}-\d{2}-\d{2}$/.test(emissao) ? emissao : '',
    transportadora: transporta ? filhoTexto(transporta, 'xNome') : '',
    itens,
  };
}

/**
 * Casa as linhas da NF com os itens do pedido e devolve a nova lista de
 * itensFaturamento ja selecionada, mais um resumo do que ficou de fora.
 *
 * `itensFaturamento` sao os itens do pedido com os campos internos do modal
 * (_selected, _qtdFaturar, _saldo, ...).
 */
export function casarItensNFe(itensFaturamento, itensNFe) {
  // Indice referencia -> posicoes no pedido. Um mesmo item entra por todas as
  // referencias que tiver, porque o cProd do emissor pode ser a ref dele, a ref
  // Linx ou a generica, e isso varia por fornecedor.
  const porRef = new Map();
  itensFaturamento.forEach((item, i) => {
    if (item._saldo <= 0) return;
    [item.referencia_fornecedor, item.referencia_linx, item.referencia].forEach((ref) => {
      const k = chaveRef(ref);
      if (!k) return;
      if (!porRef.has(k)) porRef.set(k, []);
      if (!porRef.get(k).includes(i)) porRef.get(k).push(i);
    });
  });

  const usados = new Set();
  const casamentos = [];
  const semCasar = [];
  const alertas = [];

  for (const linha of itensNFe) {
    const desc = normalizar(linha.xProd);
    const todosDaRef = porRef.get(chaveRef(linha.cProd)) || [];
    const candidatos = todosDaRef.filter(i => !usados.has(i));
    let alvo = null;
    let corConfirmada = false;

    if (candidatos.length === 1) {
      alvo = candidatos[0];
      const cor = normalizar(itensFaturamento[alvo].cor_selecionada?.cor_nome);
      corConfirmada = !!cor && desc.includes(cor);
    } else if (candidatos.length > 1) {
      // Mesma referencia em cores diferentes: a cor tem que aparecer na
      // descricao da NF para desempatar. Se nao aparecer, ninguem e escolhido.
      const porCor = candidatos.filter((i) => {
        const cor = normalizar(itensFaturamento[i].cor_selecionada?.cor_nome);
        return cor && desc.includes(cor);
      });
      if (porCor.length === 1) {
        alvo = porCor[0];
        corConfirmada = true;
      }
    }

    if (alvo === null) {
      // Ultimo recurso, para fornecedor sem referencia cadastrada: descricao da
      // NF identica ao nome do produto, e um unico item ainda livre.
      const porNome = itensFaturamento
        .map((_, i) => i)
        .filter(i => !usados.has(i)
          && itensFaturamento[i]._saldo > 0
          && desc
          && normalizar(itensFaturamento[i].nome) === desc);
      if (porNome.length === 1) alvo = porNome[0];
    }

    if (alvo === null) {
      semCasar.push({
        linha,
        motivo: candidatos.length > 1
          ? 'a referência aparece em mais de uma cor e a descrição da NF não diz qual'
          : 'referência não encontrada entre os itens em aberto do pedido',
      });
      continue;
    }

    const item = itensFaturamento[alvo];

    // Casou porque sobrou um so candidato daquela referencia, sem a cor aparecer
    // na descricao da NF. O valor bate (mesma referencia, mesmo preco), mas a
    // baixa vai numa cor que ninguem confirmou -- precisa ser conferido.
    if (!corConfirmada && todosDaRef.length > 1) {
      alertas.push(`${item.nome} (${(item.cor_selecionada?.cor_nome || '').trim()}): casado por eliminação, a NF não diz a cor. Confira.`);
    }

    const pecasGrade = parseInt(item.total_pecas_grade) || 0;
    const ehGrade = item.tipo_venda === 'grade' && pecasGrade > 0;

    let qtd = linha.qCom;
    if (ehGrade) {
      if (qtd % pecasGrade !== 0) {
        alertas.push(`${item.nome}: a NF traz ${qtd} peças, que não fecham grades de ${pecasGrade}. Confira a quantidade.`);
      }
      qtd = Math.floor(qtd / pecasGrade);
    }

    if (qtd <= 0) {
      semCasar.push({ linha, motivo: 'quantidade da NF menor que uma grade fechada' });
      continue;
    }

    if (qtd > item._saldo) {
      alertas.push(`${item.nome}: a NF traz mais do que o saldo em aberto. Ajustado para ${item._saldo}.`);
      qtd = item._saldo;
    }

    usados.add(alvo);
    casamentos.push({ indice: alvo, qtd });
  }

  const porIndice = new Map(casamentos.map(c => [c.indice, c.qtd]));
  const itens = itensFaturamento.map((item, i) => {
    if (!porIndice.has(i)) return item;
    return {
      ...item,
      _selected: true,
      _qtdFaturar: porIndice.get(i),
      _isQuebra: false,
      _qtdQuebra: 0,
    };
  });

  // Itens do pedido em aberto que a NF nao cobriu: faturamento parcial legitimo,
  // mas o fornecedor precisa ver que ficaram de fora de proposito.
  const naoCobertos = itensFaturamento
    .map((item, i) => ({ item, i }))
    .filter(({ item, i }) => item._saldo > 0 && !porIndice.has(i))
    .map(({ item }) => item.nome);

  return {
    itens,
    resumo: {
      totalNF: itensNFe.length,
      casados: casamentos.length,
      semCasar,
      alertas,
      naoCobertos,
    },
  };
}
