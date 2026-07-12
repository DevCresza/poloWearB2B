import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Utilitários para exportação de dados para CSV e PDF

/**
 * Converte array de objetos para CSV
 * @param {Array} data - Array de objetos com os dados
 * @param {Array} columns - Array com as colunas {key, label}
 * @param {string} filename - Nome do arquivo
 */
export const exportToCSV = (data, columns, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    toast.info('Não há dados para exportar');
    return;
  }

  // Separador pt-BR: ponto-e-virgula. Evita colisao com a virgula decimal
  // dos numeros em formato brasileiro (Excel pt-BR usa ; por padrao).
  const SEP = ';';

  // Criar cabeçalhos
  const headers = columns.map(col => col.label).join(SEP);

  // Criar linhas
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.key];

      // Formatar valores
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'number') {
        value = Number.isInteger(value)
          ? String(value)
          : value.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
              useGrouping: false
            });
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }

      // Escapar separador, aspas e quebras de linha
      if (value.includes(SEP) || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    }).join(SEP);
  }).join('\n');

  // CRLF (RFC 4180) + BOM UTF-8. NAO usar diretiva "sep=;" antes do
  // BOM: o Excel ignora o BOM quando ve "sep=" como primeira linha
  // e cai pra Windows-1252, gerando mojibakes "Ã£", "Ã§", "RAZAO".
  // Sem o sep=, o Excel pt-BR detecta o ";" pela config regional.
  const csv = `\uFEFF${headers}\r\n${rows.replace(/\n/g, "\r\n")}`;

  // Criar blob e download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.cssText = 'visibility:hidden;position:fixed;';

  document.body.appendChild(link);

  // Usar setTimeout para garantir que o DOM foi atualizado
  setTimeout(() => {
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso!');
  }, 100);
};

/**
 * Exporta dados para PDF usando jsPDF
 * @param {Array} data - Array de objetos com os dados
 * @param {Array} columns - Array com as colunas {key, label}
 * @param {string} title - Título do relatório
 * @param {string} filename - Nome do arquivo
 */
export const exportToPDF = (data, columns, title = 'Relatório', filename = 'export.pdf', options = {}) => {
  if (!data || data.length === 0) {
    toast.info('Não há dados para exportar');
    return;
  }

  try {
    const doc = new jsPDF({ orientation: options.orientation || 'portrait' });

    // Adicionar título
    doc.setFontSize(16);
    doc.text(title, 14, 15);

    // Adicionar data de geração
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, 14, 22);

    // Preparar dados para a tabela
    const headers = [columns.map(col => col.label)];
    const rows = data.map(item =>
      columns.map(col => {
        let value = item[col.key];

        // Formatar valores
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'object') {
          return JSON.stringify(value);
        } else if (typeof value === 'number') {
          // Formatar números com 2 casas decimais se for decimal
          return value % 1 !== 0 ? value.toFixed(2) : value.toString();
        } else {
          return String(value);
        }
      })
    );

    // Adicionar tabela usando autoTable
    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 28 },
    });

    // Salvar PDF
    doc.save(filename);
    toast.success('PDF exportado com sucesso!');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    toast.error('Erro ao gerar PDF. Tente novamente.');
  }
};

/**
 * Gera relatório em formato texto (fallback)
 */
const generateTextReport = (data, columns, title) => {
  let text = `${title}\n`;
  text += `Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
  text += '='.repeat(80) + '\n\n';

  // Cabeçalhos
  text += columns.map(col => col.label.padEnd(20)).join(' | ') + '\n';
  text += '-'.repeat(80) + '\n';

  // Dados
  data.forEach(item => {
    text += columns.map(col => {
      let value = item[col.key];
      if (value === null || value === undefined) value = '';
      else if (typeof value === 'object') value = JSON.stringify(value);
      else value = String(value);
      return value.substring(0, 20).padEnd(20);
    }).join(' | ') + '\n';
  });

  text += '\n' + '='.repeat(80) + '\n';
  text += `Total de registros: ${data.length}\n`;

  return text;
};

/**
 * Formata valor monetário
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Formata data (fuso horário de São Paulo)
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Formata data e hora (fuso horário de São Paulo)
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Retorna string YYYY-MM-DD no fuso de São Paulo (para comparações de filtro)
 */
export const toBrasiliaDateString = (date) => {
  if (!date) return '';
  const d = new Date(date);
  // Formatar componentes individuais no fuso de São Paulo
  const parts = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // en-CA retorna YYYY-MM-DD
  return parts;
};

/**
 * Retorna data/hora atual no fuso de São Paulo formatada
 */
export const formatNow = () => {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Formata "mês de ano" (ex: "setembro de 2026") no fuso de São Paulo.
 * Datas puras (YYYY-MM-DD) recebem T00:00:00 para não retroceder um dia no UTC.
 */
export const formatMesAno = (date) => {
  if (!date) return '';
  const d = new Date(typeof date === 'string' && date.length === 10 ? `${date}T00:00:00` : date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
};

/**
 * Mês de entrega prevista de UM item do pedido.
 *
 * O mês é uma propriedade do ITEM, não do pedido: um mesmo pedido pode misturar
 * itens de cápsulas com entregas diferentes (ex: CAPS3 setembro + CAPS4 outubro).
 * Por isso a previsão cadastrada no PRODUTO manda na previsão do pedido.
 *
 * Prioridade: entrega do produto > entrega do pedido > data do pedido (último
 * recurso, só quando nada foi cadastrado).
 */
export const getMesEntregaItem = (pedido, item, produtoEntregaMap = {}) => {
  const entregaProduto = item?.produto_id ? produtoEntregaMap[item.produto_id] : null;
  return formatMesAno(
    entregaProduto
      || pedido?.data_prevista_entrega
      || pedido?.created_date
  );
};

/**
 * Mês de faturamento de UM item do pedido.
 *
 * Igual ao mês de entrega, mas a NF emitida vence a previsão: uma vez faturado,
 * o mês real do faturamento é o da nota.
 */
export const getMesFaturamentoItem = (pedido, item, produtoEntregaMap = {}) => {
  if (pedido?.nf_data_upload) return formatMesAno(pedido.nf_data_upload);
  return getMesEntregaItem(pedido, item, produtoEntregaMap);
};
