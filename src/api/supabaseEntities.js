// Supabase Entities - Entidades que usam APENAS Supabase (sem fallback para Mock)
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Cria uma entidade Supabase com métodos CRUD
 * @param {string} tableName - Nome da tabela no Supabase
 */
const createSupabaseEntity = (tableName) => {
  return {
    /**
     * Listar registros
     * @param {object} options - Opções de filtro, ordenação, etc
     */
    async list(options = {}) {
      if (!isSupabaseConfigured()) {
        throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      try {
        let query = supabase.from(tableName).select('*');

        // Aplicar filtros
        if (options.filters) {
          Object.entries(options.filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        // Aplicar ordenação
        if (options.sort) {
          const isDesc = options.sort.startsWith('-');
          const field = isDesc ? options.sort.substring(1) : options.sort;
          query = query.order(field, { ascending: !isDesc });
        }

        // Aplicar limite
        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log(`✅ ${tableName}.list: ${data.length} registros (Supabase)`);
        return data || [];
      } catch (error) {
        console.error(`❌ Erro ao listar ${tableName}:`, error);
        throw new Error(`Erro ao listar ${tableName}: ${error.message}`);
      }
    },

    /**
     * Filtrar registros (sintaxe simplificada)
     */
    async filter(filters = {}, sort = null, limit = null) {
      const options = { filters };
      if (sort) options.sort = sort;
      if (limit) options.limit = limit;
      return this.list(options);
    },

    /**
     * Obter registro por ID
     */
    async get(id) {
      if (!isSupabaseConfigured()) {
        throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        console.log(`✅ ${tableName}.get: ${id} (Supabase)`);
        return data;
      } catch (error) {
        console.error(`❌ Erro ao buscar ${tableName}:`, error);
        throw new Error(`Erro ao buscar ${tableName}: ${error.message}`);
      }
    },

    /**
     * Criar novo registro
     */
    async create(data) {
      if (!isSupabaseConfigured()) {
        throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      try {
        const { data: created, error } = await supabase
          .from(tableName)
          .insert([data])
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ ${tableName}.create: ${created.id} (Supabase)`);
        return created;
      } catch (error) {
        console.error(`❌ Erro ao criar ${tableName}:`, error);
        throw new Error(`Erro ao criar ${tableName}: ${error.message}`);
      }
    },

    /**
     * Atualizar registro
     */
    async update(id, data) {
      if (!isSupabaseConfigured()) {
        throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      try {
        const { data: updated, error } = await supabase
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        console.log(`✅ ${tableName}.update: ${id} (Supabase)`);
        return updated;
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${tableName}:`, error);
        throw new Error(`Erro ao atualizar ${tableName}: ${error.message}`);
      }
    },

    /**
     * Deletar registro
     */
    async delete(id) {
      if (!isSupabaseConfigured()) {
        throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      try {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);

        if (error) throw error;

        console.log(`✅ ${tableName}.delete: ${id} (Supabase)`);
        return { id };
      } catch (error) {
        console.error(`❌ Erro ao deletar ${tableName}:`, error);
        throw new Error(`Erro ao deletar ${tableName}: ${error.message}`);
      }
    },

    /**
     * Contar registros
     */
    async count(filters = {}) {
      if (!isSupabaseConfigured()) {
        throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      try {
        let query = supabase.from(tableName).select('*', { count: 'exact', head: true });

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        const { count, error } = await query;

        if (error) throw error;

        console.log(`✅ ${tableName}.count: ${count} (Supabase)`);
        return count;
      } catch (error) {
        console.error(`❌ Erro ao contar ${tableName}:`, error);
        throw new Error(`Erro ao contar ${tableName}: ${error.message}`);
      }
    },
  };
};

// Criar todas as entidades Supabase (SEM Mock)
export const Produto = createSupabaseEntity('produtos');
export const Fornecedor = createSupabaseEntity('fornecedores');
export const Franqueado = createSupabaseEntity('franqueados');
export const Pedido = createSupabaseEntity('pedidos');
export const Contact = createSupabaseEntity('contacts');
export const Capsula = createSupabaseEntity('capsulas');
export const PendingUser = createSupabaseEntity('pending_users');
export const MovimentacaoEstoque = createSupabaseEntity('movimentacoes_estoque');
export const Recurso = createSupabaseEntity('recursos');
export const WhatsappTemplate = createSupabaseEntity('whatsapp_templates');
export const Carteira = createSupabaseEntity('carteira');
export const Meta = createSupabaseEntity('metas');
export const UserTable = createSupabaseEntity('users'); // Tabela users (CRUD - diferente de User auth)
