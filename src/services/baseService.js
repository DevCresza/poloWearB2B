// Base Service - Camada de abstração para operações CRUD com Base44/Mock entities

/**
 * BaseService fornece operações CRUD genéricas que podem ser usadas
 * por qualquer entidade do Base44
 */
class BaseService {
  constructor(Entity) {
    this.Entity = Entity;
  }

  /**
   * Buscar todos os registros com filtros opcionais
   * @param {Object} options - Opções de busca
   * @param {Object} options.filters - Filtros a aplicar
   * @param {Object} options.sort - Ordenação {field, order: 'asc' | 'desc'}
   * @param {number} options.limit - Limite de resultados
   * @param {number} options.offset - Offset para paginação
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async find(options = {}) {
    try {
      const data = await this.Entity.list(options);
      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar por ID
   * @param {string} id - ID do registro
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async findById(id) {
    try {
      const data = await this.Entity.get(id);
      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Criar novo registro
   * @param {Object} data - Dados para criar
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async create(data) {
    try {
      const result = await this.Entity.create(data);
      return this.handleSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Atualizar registro existente
   * @param {string} id - ID do registro
   * @param {Object} data - Dados para atualizar
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async update(id, data) {
    try {
      const result = await this.Entity.update(id, data);
      return this.handleSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Deletar registro
   * @param {string} id - ID do registro
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async delete(id) {
    try {
      const result = await this.Entity.delete(id);
      return this.handleSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Contar registros com filtros opcionais
   * @param {Object} filters - Filtros a aplicar
   * @returns {Promise<{success: boolean, data?: number, error?: string}>}
   */
  async count(filters = {}) {
    try {
      const count = await this.Entity.count(filters);
      return this.handleSuccess(count);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar com filtro de texto (se a entidade suportar)
   * @param {string} field - Campo para buscar
   * @param {string} searchTerm - Termo de busca
   * @param {Object} options - Opções adicionais
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async search(field, searchTerm, options = {}) {
    try {
      const data = await this.Entity.list({
        ...options,
        filters: {
          ...options.filters,
          [field]: searchTerm
        }
      });

      // Filtro manual para busca parcial (ILIKE)
      const filtered = data.filter(item => {
        const value = item[field];
        if (!value) return false;
        return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
      });

      return this.handleSuccess(filtered);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Helper para formatar resposta de sucesso
   * @param {*} data - Dados a retornar
   * @returns {{success: true, data: *}}
   */
  handleSuccess(data) {
    return {
      success: true,
      data
    };
  }

  /**
   * Helper para formatar resposta de erro
   * @param {Error} error - Erro a formatar
   * @returns {{success: false, error: string, details: Error}}
   */
  handleError(error) {
    return {
      success: false,
      error: error?.message || 'Erro desconhecido',
      details: error
    };
  }
}

export default BaseService;
