// Pedido Service - Operações específicas para pedidos

import BaseService from './baseService';
import { Pedido, Produto, Fornecedor } from '@/api/entities';
import { authService } from './auth';

class PedidoService extends BaseService {
  constructor() {
    super(Pedido);
  }

  /**
   * Buscar pedidos completos (com informações de produtos e fornecedores)
   * @param {Object} filters - Filtros opcionais
   */
  async findCompletos(filters = {}) {
    try {
      const pedidos = await this.Entity.list({ filters });

      // Para cada pedido, buscar informações completas dos produtos
      const pedidosCompletos = await Promise.all(
        pedidos.map(async (pedido) => {
          if (pedido.itens && Array.isArray(pedido.itens)) {
            const itensCompletos = await Promise.all(
              pedido.itens.map(async (item) => {
                try {
                  const produto = await Produto.get(item.produto_id);
                  return {
                    ...item,
                    produto
                  };
                } catch (error) {
                  return item;
                }
              })
            );

            return {
              ...pedido,
              itens: itensCompletos
            };
          }

          return pedido;
        })
      );

      return this.handleSuccess(pedidosCompletos);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar pedidos por fornecedor
   * Se o usuário for fornecedor, retorna apenas pedidos com seus produtos
   */
  async findByFornecedor(fornecedorId = null) {
    try {
      const currentUser = authService.getCurrentUser();

      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      let targetFornecedorId = fornecedorId;

      // Se é fornecedor, busca seu fornecedor via responsavel_user_id
      if (currentUser.tipo_negocio === 'fornecedor') {
        const fornecedoresList = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
        const fornecedor = fornecedoresList[0];

        if (fornecedor) {
          targetFornecedorId = fornecedor.id;
        } else {
          return this.handleSuccess([]);
        }
      }

      const pedidosResponse = await this.findCompletos();

      if (!pedidosResponse.success) {
        throw new Error(pedidosResponse.error);
      }

      // Filtra pedidos que contenham produtos do fornecedor
      const pedidosFornecedor = pedidosResponse.data.filter(pedido => {
        if (!pedido.itens || !Array.isArray(pedido.itens)) return false;

        return pedido.itens.some(item => {
          return item.produto?.fornecedor_id === targetFornecedorId;
        });
      });

      return this.handleSuccess(pedidosFornecedor);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar pedidos por cliente
   * @param {string} clienteId - ID do cliente
   */
  async findByCliente(clienteId = null) {
    try {
      const currentUser = authService.getCurrentUser();

      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      // Se é cliente, usa seu ID
      const targetClienteId = currentUser.tipo_negocio === 'multimarca'
        ? currentUser.id
        : clienteId;

      const filters = { cliente_id: targetClienteId };

      return await this.findCompletos(filters);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar pedidos por status
   * @param {string} status - Status do pedido
   */
  async findByStatus(status) {
    try {
      return await this.findCompletos({ status });
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Criar pedido a partir de itens do carrinho
   * @param {Array} itens - Array de itens {produto_id, quantidade, preco_unitario, grade}
   * @param {Object} dadosEntrega - Dados de entrega opcional
   */
  async createFromCarrinho(itens, dadosEntrega = {}) {
    try {
      const currentUser = authService.getCurrentUser();

      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }

      // Calcula total
      const total = itens.reduce((sum, item) => {
        return sum + (item.preco_unitario * item.quantidade);
      }, 0);

      // Cria pedido
      const pedido = await this.Entity.create({
        cliente_id: currentUser.id,
        status: 'pendente',
        itens,
        total,
        data_pedido: new Date().toISOString(),
        ...dadosEntrega
      });


      return this.handleSuccess(pedido);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Atualizar status do pedido
   * @param {string} pedidoId - ID do pedido
   * @param {string} novoStatus - Novo status
   * @param {string} observacao - Observação opcional
   */
  async updateStatus(pedidoId, novoStatus, observacao = '') {
    try {
      const pedido = await this.Entity.get(pedidoId);

      if (!pedido) {
        throw new Error('Pedido não encontrado');
      }

      const updatedPedido = await this.Entity.update(pedidoId, {
        status: novoStatus,
        observacao,
        updated_at: new Date().toISOString()
      });

        pedidoId,
        status: novoStatus
      });

      return this.handleSuccess(updatedPedido);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Cancelar pedido
   * @param {string} pedidoId - ID do pedido
   * @param {string} motivo - Motivo do cancelamento
   */
  async cancelar(pedidoId, motivo) {
    try {
      return await this.updateStatus(pedidoId, 'cancelado', motivo);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Calcular estatísticas de pedidos
   * @param {Object} filters - Filtros opcionais (período, status, etc.)
   */
  async getEstatisticas(filters = {}) {
    try {
      const pedidosResponse = await this.findCompletos(filters);

      if (!pedidosResponse.success) {
        throw new Error(pedidosResponse.error);
      }

      const pedidos = pedidosResponse.data;

      const stats = {
        total: pedidos.length,
        valor_total: pedidos.reduce((sum, p) => sum + (p.total || 0), 0),
        por_status: {},
        ticket_medio: 0
      };

      // Conta por status
      pedidos.forEach(pedido => {
        const status = pedido.status || 'pendente';
        stats.por_status[status] = (stats.por_status[status] || 0) + 1;
      });

      // Calcula ticket médio
      if (stats.total > 0) {
        stats.ticket_medio = stats.valor_total / stats.total;
      }

      return this.handleSuccess(stats);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar pedidos por período
   * @param {Date} dataInicio - Data de início
   * @param {Date} dataFim - Data de fim
   */
  async findByPeriodo(dataInicio, dataFim) {
    try {
      const pedidosResponse = await this.findCompletos();

      if (!pedidosResponse.success) {
        throw new Error(pedidosResponse.error);
      }

      const pedidos = pedidosResponse.data.filter(pedido => {
        const dataPedido = new Date(pedido.data_pedido);
        return dataPedido >= dataInicio && dataPedido <= dataFim;
      });

      return this.handleSuccess(pedidos);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const pedidoService = new PedidoService();
export default pedidoService;
