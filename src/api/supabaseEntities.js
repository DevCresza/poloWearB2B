// Supabase Entities - Entidades que usam APENAS Supabase (sem fallback para Mock)
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Mensagens para os codigos que o usuario de fato encontra. O resto segue com a
// mensagem do banco -- as travas (triggers) ja levantam texto em portugues.
const MENSAGEM_POR_CODIGO = {
  '23505': 'Já existe um registro igual (duplicado).',
  '23503': 'O registro está ligado a outros dados e não pode ser alterado ou excluído.',
  '42501': 'Sem permissão para esta operação.',
};

/**
 * Erro da camada de entidades. Preserva code/details/hint do PostgREST/Postgres
 * (antes eram descartados e o 23505 de duplicidade nunca chegava a tela).
 */
export class EntidadeError extends Error {
  constructor(acao, tableName, original) {
    const code = original?.code;
    const texto = MENSAGEM_POR_CODIGO[code] || original?.message || 'erro desconhecido';
    super(`Erro ao ${acao} ${tableName}: ${texto}`);
    this.name = 'EntidadeError';
    this.code = code;
    this.details = original?.details;
    this.hint = original?.hint;
    this.cause = original;
  }
}

// Codigo proprio para "a operacao rodou e nao afetou nenhuma linha". Com RLS
// e isso que acontece quando o usuario nao tem permissao: o banco nao da erro,
// so nao apaga/altera nada -- e a tela dizia "excluido com sucesso".
export const SEM_LINHAS = 'SEM_LINHAS';

const semLinhas = (acao) => ({
  code: SEM_LINHAS,
  message: `nenhum registro foi ${acao}. Ele não existe mais ou você não tem permissão para isso.`,
});

const exigirConfig = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('❌ Supabase não configurado. Verifique as variáveis de ambiente.');
  }
};

/**
 * Cria uma entidade Supabase com métodos CRUD
 * @param {string} tableName - Nome da tabela no Supabase
 * @param {object} [config]
 * @param {string[]} [config.chave] - colunas que identificam a linha, usadas
 *   como desempate na ordenacao da paginacao. Padrao ['id']; views sem id
 *   informam a propria chave.
 */
export const createSupabaseEntity = (tableName, config = {}) => {
  const chave = config.chave || ['id'];
  return {
    /**
     * Listar registros
     * @param {object} options - Opções de filtro, ordenação, etc
     */
    async list(options = {}) {
      exigirConfig();

      try {
        // Monta a query base (filtros + ordenacao). Reconstruida a cada pagina
        // porque o query builder do supabase-js e de uso unico.
        // options.columns: traz so as colunas pedidas. A tela de Pedidos monta
        // um mapa com 3 campos do produto e baixava a tabela inteira (986 kB de
        // 642 produtos, com variantes_cor e descricoes) para isso.
        const montarQuery = (comContagem = false) => {
          let q = supabase
            .from(tableName)
            .select(options.columns || '*', comContagem ? { count: 'exact' } : undefined);
          if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
              q = q.eq(key, value);
            });
          }
          let campoOrdem = null;
          if (options.sort) {
            const isDesc = options.sort.startsWith('-');
            campoOrdem = isDesc ? options.sort.substring(1) : options.sort;
            q = q.order(campoOrdem, { ascending: !isDesc });
          }
          // Desempate pela chave: sem ele, linhas com o mesmo valor de
          // ordenacao (ou sem ordenacao nenhuma) podem trocar de lugar entre
          // uma pagina e outra, e a lista repete ou pula registros (M2).
          for (const col of chave) {
            if (col !== campoOrdem) q = q.order(col, { ascending: true });
          }
          return q;
        };

        // Com limite explicito: uma requisicao so (o chamador quer no maximo N).
        if (options.limit) {
          const { data, error } = await montarQuery().limit(options.limit);
          if (error) throw error;
          return data || [];
        }

        // Sem limite: o Supabase corta em 1000 linhas POR requisicao ("Max rows").
        // Sem paginar, telas com mais de 1000 registros (pedidos, carteira...)
        // mostravam dados e totais incompletos. Aqui buscamos em blocos ate
        // acabar, entao list() volta a significar "todos os registros".
        const PAGINA = 1000;

        // A primeira pagina vem com a contagem exata. Sabendo o total, as demais
        // vao em PARALELO: em serie, pedidos_resumo (5.951 linhas) custava 6
        // idas e voltas encadeadas, e no 4G fraco de celular isso e a diferenca
        // entre a tela abrir e ficar girando para sempre.
        const primeira = await montarQuery(true).range(0, PAGINA - 1);
        if (primeira.error) throw primeira.error;
        const inicial = primeira.data || [];

        if (inicial.length < PAGINA) return inicial;

        const total = primeira.count;
        if (total == null) {
          // Sem contagem (view ou RLS que nao devolve count) nao da para saber
          // quantas paginas faltam: volta ao laco sequencial, que e lento mas
          // nunca perde linha.
          let todos = inicial;
          let inicio = PAGINA;
          for (;;) {
            const { data, error } = await montarQuery().range(inicio, inicio + PAGINA - 1);
            if (error) throw error;
            const bloco = data || [];
            todos = todos.concat(bloco);
            if (bloco.length < PAGINA) break;
            inicio += PAGINA;
          }
          return todos;
        }

        const paginasRestantes = Math.ceil(total / PAGINA) - 1;
        if (paginasRestantes <= 0) return inicial;

        const blocos = await Promise.all(
          Array.from({ length: paginasRestantes }, (_, i) => {
            const inicio = (i + 1) * PAGINA;
            return montarQuery().range(inicio, inicio + PAGINA - 1);
          })
        );

        let todos = inicial;
        for (const { data, error } of blocos) {
          if (error) throw error;
          todos = todos.concat(data || []);
        }
        return todos;
      } catch (error) {
        throw new EntidadeError('listar', tableName, error);
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
     * Listar varios registros por id, em uma requisicao so.
     * Existe para telas que precisam de poucos registros de uma tabela grande
     * (ex: os produtos de UM pedido) sem baixar a tabela inteira.
     */
    async listByIds(ids = [], options = {}) {
      exigirConfig();

      const unicos = [...new Set((ids || []).filter(Boolean))];
      if (unicos.length === 0) return [];

      try {
        // Fatiado pra nao estourar o tamanho da URL com muitos uuids.
        const LOTE = 100;
        let todos = [];
        for (let i = 0; i < unicos.length; i += LOTE) {
          const { data, error } = await supabase
            .from(tableName)
            .select(options.columns || '*')
            .in('id', unicos.slice(i, i + LOTE));
          if (error) throw error;
          todos = todos.concat(data || []);
        }
        return todos;
      } catch (error) {
        throw new EntidadeError('listar', tableName, error);
      }
    },

    /**
     * Obter registro por ID
     * @param {object} [options] - { columns } para trazer so parte das colunas
     */
    async get(id, options = {}) {
      exigirConfig();

      try {
        const { data, error } = await supabase
          .from(tableName)
          .select(options.columns || '*')
          .eq('id', id)
          .single();

        if (error) throw error;

        return data;
      } catch (error) {
        throw new EntidadeError('buscar', tableName, error);
      }
    },

    /**
     * Criar novo registro
     */
    async create(data) {
      exigirConfig();

      try {
        const { data: created, error } = await supabase
          .from(tableName)
          .insert([data])
          .select()
          .single();

        if (error) throw error;

        return created;
      } catch (error) {
        throw new EntidadeError('criar', tableName, error);
      }
    },

    /**
     * Atualizar registro
     */
    async update(id, data) {
      exigirConfig();

      try {
        const { data: linhas, error } = await supabase
          .from(tableName)
          .update(data)
          .eq('id', id)
          .select();

        if (error) throw error;
        // RLS que nao deixa alterar devolve 0 linhas, sem erro.
        if (!linhas || linhas.length === 0) throw semLinhas('alterado');

        return linhas[0];
      } catch (error) {
        throw new EntidadeError('atualizar', tableName, error);
      }
    },

    /**
     * Deletar registro
     */
    async delete(id) {
      exigirConfig();

      try {
        const { data: apagados, error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id)
          .select('id');

        if (error) throw error;
        // RLS que nao deixa apagar devolve 0 linhas, sem erro. Era assim que o
        // "apagar" do fornecedor falhava em silencio (C6).
        if (!apagados || apagados.length === 0) throw semLinhas('excluído');

        return { id };
      } catch (error) {
        throw new EntidadeError('excluir', tableName, error);
      }
    },

    /**
     * Contar registros
     */
    async count(filters = {}) {
      exigirConfig();

      try {
        let query = supabase.from(tableName).select('*', { count: 'exact', head: true });

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        const { count, error } = await query;

        if (error) throw error;

        return count;
      } catch (error) {
        throw new EntidadeError('contar', tableName, error);
      }
    },
  };
};

// Criar todas as entidades Supabase (SEM Mock)
export const Produto = createSupabaseEntity('produtos');
export const Fornecedor = createSupabaseEntity('fornecedores');
export const Franqueado = createSupabaseEntity('franqueados');
export const Pedido = createSupabaseEntity('pedidos');
// Versao leve para LISTAS: view sem o itens (jsonb pesado) + colunas
// pre-calculadas qtd_pecas e meses_entrega. Ler o itens de milhares de pedidos
// estourava o timeout. Use para listar; para abrir/editar UM pedido use Pedido
// (que traz o itens completo). Só leitura — grava-se sempre em `pedidos`.
export const PedidoResumo = createSupabaseEntity('pedidos_resumo');
export const Contact = createSupabaseEntity('contacts');
export const Capsula = createSupabaseEntity('capsulas');
export const PendingUser = createSupabaseEntity('pending_users');
export const MovimentacaoEstoque = createSupabaseEntity('movimentacoes_estoque');
export const Recurso = createSupabaseEntity('recursos');
export const WhatsappTemplate = createSupabaseEntity('whatsapp_templates');
export const Carteira = createSupabaseEntity('carteira');
// View (security_invoker): totais da carteira quebrados por cliente E
// fornecedor. users.total_vencido soma todos os fornecedores e nao serve
// para a tela do fornecedor. Somente leitura.
export const CarteiraTotaisPorFornecedor = createSupabaseEntity('carteira_totais_cliente_fornecedor', { chave: ['cliente_user_id', 'fornecedor_id'] });
// View (security_invoker): conferencia de cobranca por NF -- confronta a
// nota com o pedido E com os titulos. Somente leitura; ja vem recortada
// pela RLS de faturamentos/carteira.
export const ConferenciaCobranca = createSupabaseEntity('vw_conferencia_cobranca', { chave: ['faturamento_id'] });
export const Meta = createSupabaseEntity('metas');
export const UserTable = createSupabaseEntity('users'); // Tabela users (CRUD - diferente de User auth)
export const Notificacao = createSupabaseEntity('notificacoes');
export const Loja = createSupabaseEntity('lojas');
export const Banner = createSupabaseEntity('banners');
export const Faturamento = createSupabaseEntity('faturamentos');
// Trilha de auditoria de pedidos: quem mudou o que e quando. Escrita so pelo
// trigger trg_pedidos_historico -- a tabela nao tem policy de INSERT/UPDATE/
// DELETE, entao qualquer escrita daqui seria recusada pelo banco. Leitura
// recortada pela RLS: equipe ve tudo, cliente o proprio, fornecedor os dele.
export const PedidoHistorico = createSupabaseEntity('pedido_historico');
