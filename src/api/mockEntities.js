// Sistema de entidades mockado para substituir Base44

import {
  mockProdutos,
  mockPedidos,
  mockFornecedores,
  mockClientes,
  mockContacts,
  mockWhatsappTemplates,
  mockRecursos,
  mockCapsulas,
  mockMovimentacoesEstoque,
  mockCarteira,
  mockMetas,
  mockPendingUsers,
} from './mockData';

// Helper para simular delay de rede
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Helper para gerar ID único
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper para filtrar dados
const applyFilters = (data, filters = {}) => {
  if (!filters || Object.keys(filters).length === 0) return data;

  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null) return true;
      return item[key] === value;
    });
  });
};

// Helper para ordenação
const applySort = (data, sort = {}) => {
  if (!sort.field) return data;

  return [...data].sort((a, b) => {
    const aVal = a[sort.field];
    const bVal = b[sort.field];

    if (sort.order === 'desc') {
      return aVal < bVal ? 1 : -1;
    }
    return aVal > bVal ? 1 : -1;
  });
};

// Factory para criar entidade mockada
const createMockEntity = (entityName, dataArray) => {
  return {
    // Listar com filtros
    async list(options = {}) {
      await delay();

      let result = [...dataArray];

      // Aplicar filtros
      if (options.filters) {
        result = applyFilters(result, options.filters);
      }

      // Aplicar ordenação
      if (options.sort) {
        result = applySort(result, options.sort);
      }

      // Aplicar paginação
      if (options.limit) {
        const offset = options.offset || 0;
        result = result.slice(offset, offset + options.limit);
      }

      return result;
    },

    // Obter por ID
    async get(id) {
      await delay();

      const item = dataArray.find(item => item.id === id);
      if (!item) {
        throw new Error(`${entityName} não encontrado`);
      }

      return item;
    },

    // Criar
    async create(data) {
      await delay();

      const newItem = {
        id: generateId(entityName.toLowerCase()),
        ...data,
        createdAt: new Date(),
      };

      dataArray.push(newItem);
      return newItem;
    },

    // Atualizar
    async update(id, data) {
      await delay();

      const index = dataArray.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error(`${entityName} não encontrado`);
      }

      const updatedItem = {
        ...dataArray[index],
        ...data,
        updatedAt: new Date(),
      };

      dataArray[index] = updatedItem;
      return updatedItem;
    },

    // Deletar
    async delete(id) {
      await delay();

      const index = dataArray.findIndex(item => item.id === id);
      if (index === -1) {
        throw new Error(`${entityName} não encontrado`);
      }

      const deletedItem = dataArray[index];
      dataArray.splice(index, 1);

      return deletedItem;
    },

    // Count
    async count(filters = {}) {
      await delay();

      const filtered = applyFilters(dataArray, filters);
      return filtered.length;
    },

    // Filter - Alias para list() com sintaxe simplificada
    async filter(filters = {}, sort = null, limit = null) {
      const options = {
        filters,
      };

      if (sort) {
        options.sort = sort;
      }

      if (limit) {
        options.limit = limit;
      }

      return this.list(options);
    },
  };
};

// Exportar entidades
export const Produto = createMockEntity('Produto', mockProdutos);
export const Pedido = createMockEntity('Pedido', mockPedidos);
export const Fornecedor = createMockEntity('Fornecedor', mockFornecedores);
export const Contact = createMockEntity('Contact', mockContacts);
export const WhatsappTemplate = createMockEntity('WhatsappTemplate', mockWhatsappTemplates);
export const Recurso = createMockEntity('Recurso', mockRecursos);
export const Capsula = createMockEntity('Capsula', mockCapsulas);
export const MovimentacaoEstoque = createMockEntity('MovimentacaoEstoque', mockMovimentacoesEstoque);
export const Carteira = createMockEntity('Carteira', mockCarteira);
export const Meta = createMockEntity('Meta', mockMetas);
export const PendingUser = createMockEntity('PendingUser', mockPendingUsers);

// User é a autenticação (exportada de mockAuth)
export { mockAuth as User } from './mockAuth';
