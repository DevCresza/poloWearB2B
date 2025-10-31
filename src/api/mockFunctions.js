// Funções mockadas para substituir Base44

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Consultar CNPJ (mock - retorna dados fictícios)
export const consultarCNPJ = async ({ cnpj }) => {
  await delay();

  // Remove formatação
  const cnpjLimpo = cnpj.replace(/[^\d]/g, '');

  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ inválido');
  }

  // Retorna dados mockados
  return {
    cnpj: cnpj,
    razao_social: `Empresa LTDA ${cnpjLimpo.substr(-4)}`,
    nome_fantasia: `Fantasia ${cnpjLimpo.substr(-4)}`,
    situacao: 'ATIVA',
    tipo: 'MATRIZ',
    abertura: '01/01/2020',
    natureza_juridica: '206-2 - Sociedade Empresária Limitada',
    endereco: {
      logradouro: 'Rua Exemplo',
      numero: '123',
      complemento: 'Sala 1',
      bairro: 'Centro',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '01234-567',
    },
    telefone: '(11) 1234-5678',
    email: `contato@empresa${cnpjLimpo.substr(-4)}.com.br`,
  };
};

// Exportar pedidos para PDF
export const exportPedidosPDF = async ({ pedidos, filters }) => {
  await delay();


  // Simula geração de PDF
  const pdfUrl = `https://exemplo.com/pedidos-${Date.now()}.pdf`;

  return {
    success: true,
    url: pdfUrl,
    message: 'PDF gerado com sucesso',
  };
};

// Exportar pedidos para Excel
export const exportPedidosExcel = async ({ pedidos, filters }) => {
  await delay();


  // Simula geração de Excel
  const excelUrl = `https://exemplo.com/pedidos-${Date.now()}.xlsx`;

  return {
    success: true,
    url: excelUrl,
    message: 'Excel gerado com sucesso',
  };
};

// Exportar pedidos do fornecedor
export const exportPedidosFornecedor = async ({ fornecedor_id, filters }) => {
  await delay();


  const pdfUrl = `https://exemplo.com/pedidos-fornecedor-${Date.now()}.pdf`;

  return {
    success: true,
    url: pdfUrl,
    message: 'Relatório gerado com sucesso',
  };
};

// Exportar leads para CSV
export const exportLeadsCSV = async ({ leads, filters }) => {
  await delay();


  const csvUrl = `https://exemplo.com/leads-${Date.now()}.csv`;

  return {
    success: true,
    url: csvUrl,
    message: 'CSV gerado com sucesso',
  };
};

// Notificar pedido ao fornecedor
export const notificarPedidoFornecedor = async ({ pedido_id, fornecedor_id }) => {
  await delay();


  return {
    success: true,
    message: 'Fornecedor notificado com sucesso',
    notification_id: `notif-${Date.now()}`,
  };
};

// Notificar mudança de status
export const notificarMudancaStatus = async ({ pedido_id, novo_status, destinatarios }) => {
  await delay();


  return {
    success: true,
    message: 'Notificações enviadas com sucesso',
    sent_to: destinatarios || [],
  };
};

// Enviar alerta de vencimento
export const enviarAlertaVencimento = async ({ titulo_id, cliente_id, dias_vencimento }) => {
  await delay();


  return {
    success: true,
    message: 'Alerta enviado com sucesso',
    alert_id: `alert-${Date.now()}`,
  };
};

// Verificar vencimentos de títulos
export const verificarVencimentosTitulos = async ({ dias_antecedencia = 5 }) => {
  await delay();


  // Simula resultado
  const hoje = new Date();
  const dataLimite = new Date(hoje.getTime() + dias_antecedencia * 24 * 60 * 60 * 1000);

  return {
    success: true,
    titulos_vencendo: [
      {
        id: 'carteira-1',
        cliente_id: 'user-multimarca-1',
        valor: 1899.50,
        vencimento: dataLimite,
        dias_restantes: dias_antecedencia,
      },
    ],
    total: 1,
  };
};

// Atualizar estoque
export const atualizarEstoque = async ({ produto_id, quantidade, tipo, motivo }) => {
  await delay();


  // Simula atualização
  return {
    success: true,
    produto_id,
    novo_estoque: tipo === 'entrada' ? quantidade : -quantidade,
    movimentacao_id: `mov-${Date.now()}`,
  };
};

// Enviar WhatsApp
export const enviarWhatsApp = async ({ to, message, template_id, variables }) => {
  await delay();


  // Simula envio
  return {
    success: true,
    message_id: `whats-${Date.now()}`,
    status: 'sent',
    to,
    sent_at: new Date().toISOString(),
  };
};

// Verificar bloqueio de clientes
export const verificarBloqueioClientes = async () => {
  await delay();


  // Simula verificação
  return {
    success: true,
    clientes_bloqueados: [
      {
        cliente_id: 'user-multimarca-1',
        motivo: 'Títulos vencidos',
        dias_atraso: 15,
        valor_devido: 1899.50,
      },
    ],
    total: 1,
  };
};
