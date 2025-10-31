// Contact Service - Operações específicas para gerenciamento de contatos/leads

import BaseService from './baseService';
import { Contact } from '@/api/entities';

class ContactService extends BaseService {
  constructor() {
    super(Contact);
  }

  /**
   * Buscar contatos por status
   * @param {string} status - Status do lead (novo, em_contato, interessado, etc.)
   */
  async findByStatus(status) {
    try {
      const data = await this.Entity.list({
        filters: { status },
        sort: { field: 'created_at', order: 'desc' }
      });

      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar leads ativos (não arquivados)
   */
  async findActive() {
    try {
      const data = await this.Entity.list({
        filters: { arquivado: false },
        sort: { field: 'created_at', order: 'desc' }
      });

      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar leads arquivados
   */
  async findArchived() {
    try {
      const data = await this.Entity.list({
        filters: { arquivado: true },
        sort: { field: 'data_arquivamento', order: 'desc' }
      });

      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar contatos por origem
   * @param {string} origem - Origem do lead (whatsapp, email, site, etc.)
   */
  async findByOrigem(origem) {
    try {
      const data = await this.Entity.list({
        filters: { origem }
      });

      return this.handleSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Atualizar status do contato
   * @param {string} contactId - ID do contato
   * @param {string} novoStatus - Novo status
   */
  async updateStatus(contactId, novoStatus) {
    try {
      const updated = await this.Entity.update(contactId, {
        status: novoStatus,
        updated_at: new Date().toISOString()
      });

        contactId,
        status: novoStatus
      });

      return this.handleSuccess(updated);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Arquivar contato
   * @param {string} contactId - ID do contato
   * @param {string} motivo - Motivo do arquivamento
   */
  async archive(contactId, motivo = '') {
    try {
      const updated = await this.Entity.update(contactId, {
        arquivado: true,
        motivo_arquivamento: motivo,
        data_arquivamento: new Date().toISOString()
      });


      return this.handleSuccess(updated);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Desarquivar contato
   * @param {string} contactId - ID do contato
   */
  async unarchive(contactId) {
    try {
      const updated = await this.Entity.update(contactId, {
        arquivado: false,
        motivo_arquivamento: null,
        data_arquivamento: null
      });


      return this.handleSuccess(updated);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Adicionar nota/observação ao contato
   * @param {string} contactId - ID do contato
   * @param {string} nota - Nota a adicionar
   */
  async addNota(contactId, nota) {
    try {
      const contact = await this.Entity.get(contactId);

      if (!contact) {
        throw new Error('Contato não encontrado');
      }

      // Cria array de notas se não existir
      const notas = contact.notas || [];

      notas.push({
        texto: nota,
        data: new Date().toISOString()
      });

      const updated = await this.Entity.update(contactId, {
        notas,
        updated_at: new Date().toISOString()
      });

      return this.handleSuccess(updated);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Buscar contatos com filtros avançados
   * @param {Object} filters - Filtros (status, origem, cidade, estado)
   */
  async advancedSearch(filters = {}) {
    try {
      const response = await this.find();

      if (!response.success) {
        throw new Error(response.error);
      }

      let contacts = response.data;

      // Aplicar filtros
      if (filters.status) {
        contacts = contacts.filter(c => c.status === filters.status);
      }

      if (filters.origem) {
        contacts = contacts.filter(c => c.origem === filters.origem);
      }

      if (filters.cidade) {
        contacts = contacts.filter(c =>
          c.cidade?.toLowerCase().includes(filters.cidade.toLowerCase())
        );
      }

      if (filters.estado) {
        contacts = contacts.filter(c => c.estado === filters.estado);
      }

      if (filters.arquivado !== undefined) {
        contacts = contacts.filter(c => c.arquivado === filters.arquivado);
      }

      return this.handleSuccess(contacts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Calcular estatísticas de leads
   */
  async getEstatisticas() {
    try {
      const response = await this.find();

      if (!response.success) {
        throw new Error(response.error);
      }

      const contacts = response.data;

      const stats = {
        total: contacts.length,
        ativos: contacts.filter(c => !c.arquivado).length,
        arquivados: contacts.filter(c => c.arquivado).length,
        por_status: {},
        por_origem: {},
        conversao: 0
      };

      // Conta por status
      contacts.filter(c => !c.arquivado).forEach(contact => {
        const status = contact.status || 'novo';
        stats.por_status[status] = (stats.por_status[status] || 0) + 1;
      });

      // Conta por origem
      contacts.forEach(contact => {
        const origem = contact.origem || 'desconhecido';
        stats.por_origem[origem] = (stats.por_origem[origem] || 0) + 1;
      });

      // Calcula taxa de conversão (convertidos / total)
      const convertidos = stats.por_status['convertido'] || 0;
      if (stats.ativos > 0) {
        stats.conversao = (convertidos / stats.ativos) * 100;
      }

      return this.handleSuccess(stats);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const contactService = new ContactService();
export default contactService;
