import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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

  // Criar cabeçalhos
  const headers = columns.map(col => col.label).join(',');

  // Criar linhas
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.key];

      // Formatar valores
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }

      // Escapar vírgulas e aspas
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    }).join(',');
  }).join('\n');

  // Combinar cabeçalhos e linhas
  const csv = `\uFEFF${headers}\n${rows}`; // \uFEFF é BOM para UTF-8

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
export const exportToPDF = (data, columns, title = 'Relatório', filename = 'export.pdf') => {
  if (!data || data.length === 0) {
    toast.info('Não há dados para exportar');
    return;
  }

  try {
    const doc = new jsPDF();

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
    doc.autoTable({
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
 * Retorna data/hora atual no fuso de São Paulo formatada
 */
export const formatNow = () => {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};
