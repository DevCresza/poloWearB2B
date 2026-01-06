// Product Service - Operações específicas para produtos

import BaseService from './baseService';
import { Produto, MovimentacaoEstoque, Fornecedor } from '@/api/entities';
import { authService } from './auth';

class ProductService extends BaseService {
  constructor() {
    super(Produto);
  }

  /**
   * Buscar produtos por fornecedor
   * Se o usuário for fornecedor, retorna apenas seus produtos
   * Se for admin, retorna todos ou filtrados por fornecedor_id
   */
  async findByFornecedor(fornecedorId = null) {
    try {
      const currentUser = authService.getCurrentUser();

      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      let filters = {};

      // Se é fornecedor, busca seu fornecedor via responsavel_user_id
      if (currentUser.tipo_negocio === 'fornecedor') {
        const fornecedoresList = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
        const fornecedor = fornecedoresList[0];

        if (fornecedor) {
          filters.fornecedor_id = fornecedor.id;
        } else {
          return this.handleSuccess([]);
        }
      }
      // Se é admin e passou fornecedor_id, filtra por ele
      else if (fornecedorId && currentUser.role === 'admin') {
        filters.fornecedor_id = fornecedorId;
      }

      const data = await this.Entity.list({ filters });
      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar produtos com estoque baixo
   * @param {number} threshold - Limite de estoque baixo (padrão: 10)
   */
  async findLowStock(threshold = 10) {
    try {
      const response = await this.find();

      if (!response.success) {
        throw new Error(response.error);
      }

      const lowStockProducts = response.data.filter(
        produto => produto.estoque_atual <= threshold
      );

      return this.handleSuccess(lowStockProducts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar produtos em destaque
   */
  async findFeatured() {
    try {
      const data = await this.Entity.list({
        filters: { destaque: true }
      });
      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar produtos por marca
   * @param {string} marca - Marca para filtrar
   */
  async findByMarca(marca) {
    try {
      const data = await this.Entity.list({
        filters: { marca }
      });
      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar produtos por cápsula
   * @param {string} capsulaId - ID da cápsula
   */
  async findByCapsula(capsulaId) {
    try {
      const data = await this.Entity.list({
        filters: { capsula_id: capsulaId }
      });
      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Atualizar estoque de um produto
   * @param {string} produtoId - ID do produto
   * @param {number} quantidade - Quantidade a adicionar/remover
   * @param {string} tipo - Tipo de movimentação (entrada, saida, devolucao, ajuste)
   * @param {string} motivo - Motivo da movimentação
   * @param {string} observacao - Observação adicional
   */
  async updateEstoque(produtoId, quantidade, tipo, motivo = '', observacao = '') {
    try {
      // Busca produto atual
      const produto = await this.Entity.get(produtoId);

      if (!produto) {
        throw new Error('Produto não encontrado');
      }

      // Calcula novo estoque
      let novoEstoque = produto.estoque_atual || 0;

      switch (tipo) {
        case 'entrada':
        case 'devolucao':
          novoEstoque += quantidade;
          break;
        case 'saida':
          novoEstoque -= quantidade;
          break;
        case 'ajuste':
          novoEstoque = quantidade; // Ajuste absoluto
          break;
        default:
          throw new Error('Tipo de movimentação inválido');
      }

      // Não permite estoque negativo
      if (novoEstoque < 0) {
        throw new Error('Estoque não pode ficar negativo');
      }

      // Atualiza produto
      const updatedProduct = await this.Entity.update(produtoId, {
        estoque_atual: novoEstoque,
        updated_at: new Date().toISOString()
      });

      // Registra movimentação
      const currentUser = authService.getCurrentUser();

      await MovimentacaoEstoque.create({
        produto_id: produtoId,
        tipo,
        quantidade: Math.abs(quantidade),
        estoque_anterior: produto.estoque_atual,
        estoque_novo: novoEstoque,
        motivo,
        observacao,
        usuario_id: currentUser?.id,
        data_movimentacao: new Date().toISOString()
      });

      return this.handleSuccess(updatedProduct);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar histórico de movimentações de um produto
   * @param {string} produtoId - ID do produto
   */
  async getEstoqueHistory(produtoId) {
    try {
      const data = await MovimentacaoEstoque.list({
        filters: { produto_id: produtoId },
        sort: { field: 'data_movimentacao', order: 'desc' }
      });

      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Toggle produto em destaque
   * @param {string} produtoId - ID do produto
   */
  async toggleDestaque(produtoId) {
    try {
      const produto = await this.Entity.get(produtoId);

      if (!produto) {
        throw new Error('Produto não encontrado');
      }

      const updated = await this.Entity.update(produtoId, {
        destaque: !produto.destaque
      });

      return this.handleSuccess(updated);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar produtos com filtros avançados
   * @param {Object} filters - Filtros (marca, fornecedor_id, capsula_id, min_preco, max_preco)
   */
  async advancedSearch(filters = {}) {
    try {
      const response = await this.find();

      if (!response.success) {
        throw new Error(response.error);
      }

      let produtos = response.data;

      // Filtro por faixa de preço
      if (filters.min_preco !== undefined) {
        produtos = produtos.filter(p => p.preco_venda >= filters.min_preco);
      }

      if (filters.max_preco !== undefined) {
        produtos = produtos.filter(p => p.preco_venda <= filters.max_preco);
      }

      // Outros filtros
      if (filters.marca) {
        produtos = produtos.filter(p => p.marca === filters.marca);
      }

      if (filters.fornecedor_id) {
        produtos = produtos.filter(p => p.fornecedor_id === filters.fornecedor_id);
      }

      if (filters.capsula_id) {
        produtos = produtos.filter(p => p.capsula_id === filters.capsula_id);
      }

      // Filtro por disponibilidade
      if (filters.disponivel !== undefined) {
        produtos = produtos.filter(p => p.estoque_atual > 0);
      }

      return this.handleSuccess(produtos);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const productService = new ProductService();
export default productService;
