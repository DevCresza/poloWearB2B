// Dados mockados para substituir o Base44

// Usuários
export const mockUsers = [
  {
    id: 'user-admin-1',
    email: 'admin@polow wear.com',
    name: 'Admin Usuario',
    role: 'admin',
    tipo_negocio: 'admin',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'user-fornecedor-1',
    email: 'fornecedor@exemplo.com',
    name: 'Fornecedor Teste',
    role: 'user',
    tipo_negocio: 'fornecedor',
    razao_social: 'Fornecedor LTDA',
    cnpj: '12.345.678/0001-90',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'user-multimarca-1',
    email: 'cliente@exemplo.com',
    name: 'Cliente Multimarca',
    role: 'user',
    tipo_negocio: 'multimarca',
    razao_social: 'Loja Multimarca LTDA',
    cnpj: '98.765.432/0001-10',
    createdAt: new Date('2024-02-01'),
  },
];

// Pending Users
export const mockPendingUsers = [
  {
    id: 'pending-1',
    email: 'pendente@exemplo.com',
    name: 'Usuario Pendente',
    tipo_negocio: 'multimarca',
    razao_social: 'Nova Loja LTDA',
    cnpj: '11.222.333/0001-44',
    status: 'pending',
    createdAt: new Date('2024-10-20'),
  },
];

// Produtos
export const mockProdutos = [
  {
    id: 'prod-1',
    nome: 'Camisa Polo Azul',
    descricao: 'Camisa polo masculina azul marinho',
    preco: 129.90,
    categoria: 'Camisas',
    marca: 'Polo Wear',
    fornecedor_id: 'user-fornecedor-1',
    imagens: ['https://via.placeholder.com/400x400/0000FF/FFFFFF?text=Polo+Azul'],
    estoque: 50,
    variantes: [
      { id: 'var-1-1', tamanho: 'P', cor: 'Azul Marinho', estoque: 10 },
      { id: 'var-1-2', tamanho: 'M', cor: 'Azul Marinho', estoque: 20 },
      { id: 'var-1-3', tamanho: 'G', cor: 'Azul Marinho', estoque: 15 },
      { id: 'var-1-4', tamanho: 'GG', cor: 'Azul Marinho', estoque: 5 },
    ],
    createdAt: new Date('2024-03-01'),
  },
  {
    id: 'prod-2',
    nome: 'Camisa Polo Branca',
    descricao: 'Camisa polo masculina branca',
    preco: 119.90,
    categoria: 'Camisas',
    marca: 'Polo Wear',
    fornecedor_id: 'user-fornecedor-1',
    imagens: ['https://via.placeholder.com/400x400/FFFFFF/000000?text=Polo+Branca'],
    estoque: 30,
    variantes: [
      { id: 'var-2-1', tamanho: 'P', cor: 'Branco', estoque: 8 },
      { id: 'var-2-2', tamanho: 'M', cor: 'Branco', estoque: 12 },
      { id: 'var-2-3', tamanho: 'G', cor: 'Branco', estoque: 7 },
      { id: 'var-2-4', tamanho: 'GG', cor: 'Branco', estoque: 3 },
    ],
    createdAt: new Date('2024-03-05'),
  },
  {
    id: 'prod-3',
    nome: 'Calça Jeans Masculina',
    descricao: 'Calça jeans masculina azul escuro',
    preco: 189.90,
    categoria: 'Calças',
    marca: 'Polo Wear',
    fornecedor_id: 'user-fornecedor-1',
    imagens: ['https://via.placeholder.com/400x400/000080/FFFFFF?text=Calça+Jeans'],
    estoque: 40,
    variantes: [
      { id: 'var-3-1', tamanho: '38', cor: 'Azul', estoque: 10 },
      { id: 'var-3-2', tamanho: '40', cor: 'Azul', estoque: 15 },
      { id: 'var-3-3', tamanho: '42', cor: 'Azul', estoque: 10 },
      { id: 'var-3-4', tamanho: '44', cor: 'Azul', estoque: 5 },
    ],
    createdAt: new Date('2024-03-10'),
  },
];

// Pedidos
export const mockPedidos = [
  {
    id: 'pedido-1',
    cliente_id: 'user-multimarca-1',
    fornecedor_id: 'user-fornecedor-1',
    status: 'pendente',
    items: [
      { produto_id: 'prod-1', quantidade: 10, preco_unitario: 129.90, variante_id: 'var-1-2' },
      { produto_id: 'prod-2', quantidade: 5, preco_unitario: 119.90, variante_id: 'var-2-2' },
    ],
    subtotal: 1899.50,
    desconto: 0,
    total: 1899.50,
    observacoes: 'Pedido urgente',
    createdAt: new Date('2024-10-15'),
    updatedAt: new Date('2024-10-15'),
  },
  {
    id: 'pedido-2',
    cliente_id: 'user-multimarca-1',
    fornecedor_id: 'user-fornecedor-1',
    status: 'aprovado',
    items: [
      { produto_id: 'prod-3', quantidade: 8, preco_unitario: 189.90, variante_id: 'var-3-2' },
    ],
    subtotal: 1519.20,
    desconto: 50,
    total: 1469.20,
    observacoes: '',
    createdAt: new Date('2024-10-10'),
    updatedAt: new Date('2024-10-12'),
  },
  {
    id: 'pedido-3',
    cliente_id: 'user-multimarca-1',
    fornecedor_id: 'user-fornecedor-1',
    status: 'entregue',
    items: [
      { produto_id: 'prod-1', quantidade: 15, preco_unitario: 129.90, variante_id: 'var-1-3' },
    ],
    subtotal: 1948.50,
    desconto: 0,
    total: 1948.50,
    observacoes: '',
    createdAt: new Date('2024-09-20'),
    updatedAt: new Date('2024-10-01'),
  },
];

// Fornecedores
export const mockFornecedores = [
  {
    id: 'forn-1',
    user_id: 'user-fornecedor-1',
    razao_social: 'Fornecedor LTDA',
    nome_fantasia: 'Fornecedor Polo',
    cnpj: '12.345.678/0001-90',
    inscricao_estadual: '123.456.789.012',
    email: 'fornecedor@exemplo.com',
    telefone: '(11) 98765-4321',
    endereco: {
      cep: '01234-567',
      rua: 'Rua dos Fornecedores',
      numero: '100',
      complemento: 'Sala 5',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    ativo: true,
    createdAt: new Date('2024-01-15'),
  },
];

// Clientes
export const mockClientes = [
  {
    id: 'client-1',
    user_id: 'user-multimarca-1',
    razao_social: 'Loja Multimarca LTDA',
    nome_fantasia: 'Multimarca Store',
    cnpj: '98.765.432/0001-10',
    inscricao_estadual: '987.654.321.098',
    email: 'cliente@exemplo.com',
    telefone: '(11) 91234-5678',
    endereco: {
      cep: '04567-890',
      rua: 'Avenida Principal',
      numero: '500',
      complemento: 'Loja 2',
      bairro: 'Jardim',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    limite_credito: 50000,
    bloqueado: false,
    createdAt: new Date('2024-02-01'),
  },
];

// Contacts (CRM)
export const mockContacts = [
  {
    id: 'contact-1',
    name: 'João Silva',
    email: 'joao.silva@exemplo.com',
    phone: '(11) 99999-8888',
    company: 'Empresa XYZ',
    cargo: 'Gerente de Compras',
    tags: ['lead', 'interessado'],
    notes: 'Interessado em produtos da linha premium',
    createdAt: new Date('2024-10-01'),
  },
  {
    id: 'contact-2',
    name: 'Maria Santos',
    email: 'maria.santos@exemplo.com',
    phone: '(11) 88888-7777',
    company: 'Loja ABC',
    cargo: 'Proprietária',
    tags: ['cliente', 'vip'],
    notes: 'Cliente VIP - pedidos mensais',
    createdAt: new Date('2024-09-15'),
  },
];

// WhatsApp Templates
export const mockWhatsappTemplates = [
  {
    id: 'template-1',
    name: 'Boas-vindas',
    content: 'Olá {{nome}}! Seja bem-vindo(a) à Polo Wear!',
    variables: ['nome'],
    createdAt: new Date('2024-01-10'),
  },
  {
    id: 'template-2',
    name: 'Status Pedido',
    content: 'Olá! Seu pedido #{{pedido}} está com status: {{status}}',
    variables: ['pedido', 'status'],
    createdAt: new Date('2024-01-10'),
  },
];

// Recursos
export const mockRecursos = [
  {
    id: 'recurso-1',
    nome: 'Manual do Vendedor',
    descricao: 'Manual completo para equipe de vendas',
    tipo: 'documento',
    url: 'https://exemplo.com/manual.pdf',
    categoria: 'Treinamento',
    createdAt: new Date('2024-01-20'),
  },
  {
    id: 'recurso-2',
    nome: 'Catálogo Produtos 2024',
    descricao: 'Catálogo completo de produtos',
    tipo: 'pdf',
    url: 'https://exemplo.com/catalogo.pdf',
    categoria: 'Marketing',
    createdAt: new Date('2024-02-01'),
  },
];

// Cápsulas
export const mockCapsulas = [
  {
    id: 'capsula-1',
    nome: 'Coleção Verão 2024',
    descricao: 'Produtos para o verão',
    produtos: ['prod-1', 'prod-2'],
    imagem: 'https://via.placeholder.com/800x400/FFD700/000000?text=Verão+2024',
    ativo: true,
    data_inicio: new Date('2024-01-01'),
    data_fim: new Date('2024-03-31'),
    createdAt: new Date('2023-12-01'),
  },
  {
    id: 'capsula-2',
    nome: 'Coleção Outono 2024',
    descricao: 'Produtos para o outono',
    produtos: ['prod-3'],
    imagem: 'https://via.placeholder.com/800x400/8B4513/FFFFFF?text=Outono+2024',
    ativo: true,
    data_inicio: new Date('2024-04-01'),
    data_fim: new Date('2024-06-30'),
    createdAt: new Date('2024-03-01'),
  },
];

// Movimentações de Estoque
export const mockMovimentacoesEstoque = [
  {
    id: 'mov-1',
    produto_id: 'prod-1',
    tipo: 'entrada',
    quantidade: 50,
    motivo: 'Compra inicial',
    responsavel: 'Admin Usuario',
    data: new Date('2024-03-01'),
  },
  {
    id: 'mov-2',
    produto_id: 'prod-1',
    tipo: 'saida',
    quantidade: 10,
    motivo: 'Venda - Pedido #pedido-1',
    responsavel: 'Sistema',
    data: new Date('2024-10-15'),
  },
];

// Carteira Financeira
export const mockCarteira = [
  {
    id: 'carteira-1',
    cliente_id: 'user-multimarca-1',
    tipo: 'receber',
    valor: 1899.50,
    descricao: 'Pedido #pedido-1',
    vencimento: new Date('2024-11-15'),
    status: 'pendente',
    pedido_id: 'pedido-1',
    createdAt: new Date('2024-10-15'),
  },
  {
    id: 'carteira-2',
    cliente_id: 'user-multimarca-1',
    tipo: 'receber',
    valor: 1469.20,
    descricao: 'Pedido #pedido-2',
    vencimento: new Date('2024-11-10'),
    status: 'pago',
    data_pagamento: new Date('2024-11-05'),
    pedido_id: 'pedido-2',
    createdAt: new Date('2024-10-10'),
  },
];

// Metas
export const mockMetas = [
  {
    id: 'meta-1',
    usuario_id: 'user-fornecedor-1',
    tipo: 'vendas',
    periodo: 'mensal',
    valor_meta: 50000,
    valor_atual: 35000,
    mes: 10,
    ano: 2024,
    createdAt: new Date('2024-10-01'),
  },
  {
    id: 'meta-2',
    usuario_id: 'user-fornecedor-1',
    tipo: 'clientes',
    periodo: 'mensal',
    valor_meta: 10,
    valor_atual: 7,
    mes: 10,
    ano: 2024,
    createdAt: new Date('2024-10-01'),
  },
];

// Configuração do WhatsApp
export const mockWhatsAppConfig = {
  api_key: 'mock-api-key-12345',
  phone_number: '+5511999999999',
  webhook_url: 'https://exemplo.com/webhook',
  active: true,
};
