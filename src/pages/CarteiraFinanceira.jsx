import { useState, useEffect } from 'react';
import { abrirUrlSegura } from '@/utils/urlSegura';
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { ConferenciaCobranca } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Loja } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  DollarSign, Calendar, AlertTriangle, CheckCircle, Clock,
  Upload, Download, Filter, TrendingUp, TrendingDown, FileText,
  Search, Eye
} from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDate } from '@/utils/exportUtils';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import { useLojaContext } from '@/contexts/LojaContext';
import { Store } from 'lucide-react';
import { thumb, usarOriginalSeFalhar } from '@/utils/thumb';
import { supabase } from '@/lib/supabase';
import { hojeBR } from '@/utils/dataBR';

export default function CarteiraFinanceira() {
  const { lojaSelecionada, lojas, loading: lojasLoading } = useLojaContext();
  const [user, setUser] = useState(null);
  // Notas cujos titulos nao somam o valor da NF (view vw_conferencia_titulos_nf)
  const [conferencia, setConferencia] = useState([]);
  const [titulos, setTitulos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  // Quem ve o que (cliente / fornecedor / admin), definido no loadData. A
  // lista, os filtros e a paginacao rodam no servidor sobre este recorte.
  const [recorte, setRecorte] = useState(null);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtrosStatus, setFiltrosStatus] = useState([]); // Array para múltipla seleção
  const [filtrosFornecedor, setFiltrosFornecedor] = useState([]); // Array para múltipla seleção
  const [selectedTitulo, setSelectedTitulo] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [dataPagamentoInformada, setDataPagamentoInformada] = useState('');

  // Estados para modal de aprovação
  const [showAprovacaoModal, setShowAprovacaoModal] = useState(false);
  const [tituloParaAprovar, setTituloParaAprovar] = useState(null);
  const [dataPagamentoConfirmada, setDataPagamentoConfirmada] = useState('');

  // Estados para modal de recusa
  const [showRecusaModal, setShowRecusaModal] = useState(false);
  const [tituloParaRecusar, setTituloParaRecusar] = useState(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [processandoRecusa, setProcessandoRecusa] = useState(false);

  const [stats, setStats] = useState({
    totalAberto: 0,
    totalVencido: 0,
    proximosVencimentos: 0,
    totalPago: 0,
    totalTitulos: 0
  });
  // Parcelas do pedido aberto no modal de detalhes (buscadas ao abrir).
  const [titulosPedidoSelecionado, setTitulosPedidoSelecionado] = useState([]);

  // Estado para pesquisa por número de pedido
  const [pesquisaPedido, setPesquisaPedido] = useState('');
  const [filtroVencimentoDe, setFiltroVencimentoDe] = useState('');
  const [filtroVencimentoAte, setFiltroVencimentoAte] = useState('');
  const [filtroEmissaoDe, setFiltroEmissaoDe] = useState('');
  const [filtroEmissaoAte, setFiltroEmissaoAte] = useState('');
  const [filtroFaturamentoDe, setFiltroFaturamentoDe] = useState('');
  const [filtroFaturamentoAte, setFiltroFaturamentoAte] = useState('');

  // Estado para modal de detalhes do pedido
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  useEffect(() => {
    if (lojasLoading) return;
    loadData();
  }, [lojaSelecionada?.id, lojasLoading]);

  // users.total_em_aberto / total_vencido sao derivados da carteira pelo banco
  // (trigger trg_carteira_sync_totais + cron diario). Nao escreva esses campos
  // daqui: a tela ve so os titulos da loja selecionada e gravaria o total de
  // uma loja no campo do usuario inteiro.

  // Antes: a carteira inteira (8,5 MB no admin) + um Pedido.get com itens por
  // titulo (7.577 requisicoes, ~79 MB) + um User.get por cliente, e os filtros
  // rodando aqui. Agora a view carteira_com_pedido ja traz o resumo do pedido,
  // o nome do cliente e a parcela X de Y; a tela pede uma pagina por vez, com
  // os filtros aplicados no servidor, e os cards vem de carteira_resumo.
  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let novoRecorte = null;

      if (currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'franqueado') {
        // Cliente vê títulos associados a ele, exceto os provisorios (sem
        // parcela_numero, criados pelo Carrinho antes do fornecedor preencher
        // o pagamento) e os de pedidos ainda não aprovados ou cancelados.
        novoRecorte = {
          tipo: 'cliente',
          clienteId: currentUser.id,
          lojaId: lojaSelecionada?.id || null
        };
      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Usar fornecedor_id do usuário diretamente (se disponível)
        // ou buscar fornecedor pelo responsavel_user_id (fallback para usuários antigos)
        let fornecedorId = currentUser.fornecedor_id;
        let fornecedor = null;

        if (fornecedorId) {
          fornecedor = await Fornecedor.get(fornecedorId);
        } else {
          const fornecedoresListTemp = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
          fornecedor = fornecedoresListTemp[0];
          if (fornecedor) {
            fornecedorId = fornecedor.id;
          }
        }

        // Fornecedor vê títulos dos seus pedidos
        novoRecorte = fornecedor ? { tipo: 'fornecedor', fornecedorId } : null;
      } else if (currentUser.role === 'admin') {
        // Admin vê tudo
        novoRecorte = { tipo: 'admin' };
      }

      const [fornecedoresList, resumo] = await Promise.all([
        Fornecedor.list(),
        novoRecorte ? carregarResumo(novoRecorte) : Promise.resolve(null)
      ]);
      setFornecedores(fornecedoresList || []);
      setRecorte(novoRecorte);
      setRecarga(r => r + 1);

      setStats({
        totalAberto: Number(resumo?.total_aberto) || 0,
        totalVencido: Number(resumo?.total_vencido) || 0,
        proximosVencimentos: Number(resumo?.proximos) || 0,
        totalPago: Number(resumo?.total_pago) || 0,
        totalTitulos: Number(resumo?.total_titulos) || 0
      });

      // Conferencia NF x titulos: so para quem pode agir (equipe e fornecedor).
      // O cliente nao resolve divergencia de lancamento e so ficaria assustado.
      // A view ja vem recortada pela RLS, entao cada um ve o que e seu.
      if (currentUser.role === 'admin' || currentUser.tipo_negocio === 'fornecedor') {
        try {
          // Ordem fixa: a lista vem em paginas de 1000 e, sem ORDER BY, duas
          // paginas podiam repetir ou pular nota.
          setConferencia(await ConferenciaCobranca.list({ sort: 'faturamento_id' }));
        } catch (e) {
          // Conferencia e acessoria: se falhar, a carteira abre do mesmo jeito.
          console.warn('Erro ao carregar conferencia NF x titulos:', e);
        }
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  // Cards sobre o recorte inteiro (nao so a pagina): em aberto, vencido, vence
  // em 7 dias, pago. Vencido = vencimento antes de hoje (Brasilia); titulo
  // sem data nao e vencido.
  const carregarResumo = async (r) => {
    const { data, error } = await supabase.rpc('carteira_resumo', {
      p_hoje: hojeBR(),
      p_cliente_user_id: r.tipo === 'cliente' ? r.clienteId : null,
      p_loja_id: r.tipo === 'cliente' ? r.lojaId : null,
      p_fornecedor_id: r.tipo === 'fornecedor' ? r.fornecedorId : null,
      p_somente_cobraveis: r.tipo === 'cliente'
    });
    if (error) throw error;
    return data;
  };

  const POR_PAGINA = 50;
  const COLUNAS_TITULO = [
    'id', 'pedido_id', 'cliente_user_id', 'fornecedor_id', 'loja_id', 'parcela_numero', 'tipo',
    'descricao', 'valor', 'status', 'data_vencimento', 'data_pagamento', 'data_pagamento_informada',
    'observacoes', 'comprovante_url', 'comprovante_analisado', 'comprovante_aprovado',
    'motivo_recusa_comprovante', 'pedido_encontrado_id', 'pedido_fornecedor_id', 'cliente_nome',
    'parcela_ordem', 'parcela_total', 'parcela_ordem_cobraveis', 'parcela_total_cobraveis'
  ].join(',');

  // Valor seguro dentro de um filtro logico do PostgREST (or/and): entre
  // aspas, com \ e " escapados. No ilike, % e _ digitados viram literais, como
  // no includes() de antes.
  const aspas = (v) => `"${String(v).replace(/[\\"]/g, c => '\\' + c)}"`;
  const contem = (texto) => aspas(`*${String(texto).replace(/[\\%_]/g, c => '\\' + c)}*`);

  // O nome do cliente so aparecia (e so entrava na busca) para fornecedor e admin.
  const podeVerNomeCliente = () => user?.tipo_negocio === 'fornecedor' || user?.role === 'admin';

  // Consulta da lista com o recorte do papel e os filtros da tela. Mesmas
  // regras do filtro que rodava aqui (ver os comentarios de cada um).
  const montarConsultaTitulos = (r, { contar = false } = {}) => {
    let q = supabase
      .from('carteira_com_pedido')
      .select(COLUNAS_TITULO, contar ? { count: 'exact' } : undefined);

    if (r.tipo === 'cliente') {
      q = q.eq('cliente_user_id', r.clienteId).eq('cobravel_cliente', true);
      if (r.lojaId) q = q.eq('loja_id', r.lojaId);
    } else if (r.tipo === 'fornecedor') {
      // So parcelas: o titulo provisorio do checkout (sem parcela_numero) tem
      // fornecedor_id desde o T19, mas nunca apareceu na carteira do
      // fornecedor e continua sem aparecer.
      q = q.eq('fornecedor_id', r.fornecedorId).not('parcela_numero', 'is', null);
    }

    // Fornecedor (múltipla seleção). Mesmo recorte: antes do T19 o provisorio
    // nao tinha fornecedor_id, entao este filtro so pegava parcelas.
    if (filtrosFornecedor.length > 0) {
      q = q.in('fornecedor_id', filtrosFornecedor).not('parcela_numero', 'is', null);
    }

    // Emissão e faturamento do pedido (sem pedido ou sem NF: fica de fora)
    if (filtroEmissaoDe) q = q.gte('pedido_emissao', filtroEmissaoDe);
    if (filtroEmissaoAte) q = q.lte('pedido_emissao', filtroEmissaoAte);
    if (filtroFaturamentoDe) q = q.gte('pedido_faturamento', filtroFaturamentoDe);
    if (filtroFaturamentoAte) q = q.lte('pedido_faturamento', filtroFaturamentoAte);

    // Os filtros com OU vao todos numa arvore so: or=(and(...)).
    const grupos = [];

    // Pesquisa: número curto do pedido, id do pedido ou nome do cliente.
    if (pesquisaPedido) {
      const termos = [
        `numero_pedido.ilike.${contem(pesquisaPedido.toUpperCase())}`,
        `pedido_id_texto.ilike.${contem(pesquisaPedido.toLowerCase())}`
      ];
      if (podeVerNomeCliente()) termos.push(`cliente_nome.ilike.${contem(pesquisaPedido)}`);
      grupos.push(`or(${termos.join(',')})`);
    }

    // Vencimento: so titulos COM data dentro da faixa (ate a T15, titulo sem
    // data passava em qualquer faixa).
    if (filtroVencimentoDe || filtroVencimentoAte) {
      const faixa = [
        filtroVencimentoDe && `data_vencimento.gte.${filtroVencimentoDe}`,
        filtroVencimentoAte && `data_vencimento.lte.${filtroVencimentoAte}`
      ].filter(Boolean);
      grupos.push(`and(${faixa.join(',')})`);
    }

    // Status (múltipla seleção). "vencidos" nao e status real: pendente com
    // vencimento ANTES de hoje (Brasilia). O que vence hoje nao conta, e
    // titulo sem data tem a opcao "sem vencimento".
    if (filtrosStatus.length > 0) {
      const opcoes = [];
      const reais = filtrosStatus.filter(f => f !== 'vencidos' && f !== 'sem_vencimento');
      if (reais.length > 0) opcoes.push(`status.in.(${reais.map(aspas).join(',')})`);
      if (filtrosStatus.includes('vencidos')) {
        opcoes.push(`and(status.eq.pendente,data_vencimento.lt.${hojeBR()})`);
      }
      if (filtrosStatus.includes('sem_vencimento')) {
        opcoes.push('and(status.eq.pendente,data_vencimento.is.null)');
      }
      grupos.push(`or(${opcoes.join(',')})`);
    }

    if (grupos.length > 0) q = q.or(`and(${grupos.join(',')})`);

    return q.order('data_vencimento', { ascending: false }).order('id', { ascending: true });
  };

  // Uma pagina da lista (com a contagem do filtro).
  useEffect(() => {
    if (!recorte) {
      setTitulos([]);
      setTotalFiltrado(0);
      return;
    }
    let cancelado = false;
    const t = setTimeout(async () => {
      setCarregandoLista(true);
      try {
        const inicio = pagina * POR_PAGINA;
        const { data, count, error } = await montarConsultaTitulos(recorte, { contar: true })
          .range(inicio, inicio + POR_PAGINA - 1);
        if (error) throw error;
        if (!cancelado) {
          setTitulos(data || []);
          setTotalFiltrado(count || 0);
        }
      } catch (e) {
        if (!cancelado) {
          console.error('Erro ao carregar titulos:', e);
          toast.error('Erro ao carregar os títulos');
        }
      } finally {
        if (!cancelado) setCarregandoLista(false);
      }
    }, pesquisaPedido ? 300 : 0);
    return () => { cancelado = true; clearTimeout(t); };
    // montarConsultaTitulos le exatamente os estados listados abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorte, recarga, pagina, filtrosStatus, filtrosFornecedor, pesquisaPedido,
      filtroVencimentoDe, filtroVencimentoAte, filtroEmissaoDe, filtroEmissaoAte,
      filtroFaturamentoDe, filtroFaturamentoAte]);

  // Filtro novo volta para a primeira pagina.
  useEffect(() => {
    setPagina(0);
  }, [filtrosStatus, filtrosFornecedor, pesquisaPedido, filtroVencimentoDe, filtroVencimentoAte,
      filtroEmissaoDe, filtroEmissaoAte, filtroFaturamentoDe, filtroFaturamentoAte]);

  // Todas as linhas do filtro atual (para exportar), em blocos de 1000.
  const carregarTodosFiltrados = async () => {
    if (!recorte) return [];
    const BLOCO = 1000;
    let todos = [];
    for (let inicio = 0; ; inicio += BLOCO) {
      const { data, error } = await montarConsultaTitulos(recorte).range(inicio, inicio + BLOCO - 1);
      if (error) throw error;
      todos = todos.concat(data || []);
      if (!data || data.length < BLOCO) return todos;
    }
  };

  const handleUploadComprovante = async () => {
    if (!comprovanteFile || !selectedTitulo) {
      toast.info('Selecione um arquivo');
      return;
    }

    if (!dataPagamentoInformada) {
      toast.info('Informe a data em que o pagamento foi realizado');
      return;
    }

    setUploadingComprovante(true);
    try {
      const uploadResult = await UploadFile({
        file: comprovanteFile,
        dono: { clienteId: selectedTitulo.cliente_user_id },
      });

      // Atualizar título com comprovante e data informada
      await Carteira.update(selectedTitulo.id, {
        comprovante_url: uploadResult.file_url,
        comprovante_data_upload: new Date().toISOString(),
        comprovante_analisado: false,
        data_pagamento_informada: dataPagamentoInformada,
        status: 'em_analise'
      });

      // Notificação ao fornecedor é disparada automaticamente pelo webhook notify-pedido
      toast.success('Comprovante enviado com sucesso! Aguarde a análise.');
      setShowUploadModal(false);
      setComprovanteFile(null);
      setDataPagamentoInformada('');
      setSelectedTitulo(null);
      loadData();
    } catch (_error) {
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingComprovante(false);
    }
  };

  // Função para abrir modal de aprovação
  const handleIniciarAprovacao = (titulo) => {
    setTituloParaAprovar(titulo);
    // Usar data informada pelo cliente como sugestão, ou hoje
    setDataPagamentoConfirmada(titulo.data_pagamento_informada || hojeBR());
    setShowAprovacaoModal(true);
  };

  // Função para confirmar aprovação do comprovante
  const handleConfirmarAprovacao = async () => {
    if (!dataPagamentoConfirmada) {
      toast.error('Informe a data de pagamento confirmada');
      return;
    }

    try {
      // 1. Atualizar o título na carteira (operação principal)
      await Carteira.update(tituloParaAprovar.id, {
        comprovante_analisado: true,
        comprovante_aprovado: true,
        status: 'pago',
        data_pagamento: dataPagamentoConfirmada
      });

      // 2. Verificar auto-desbloqueio (os totais o banco ja recalculou no trigger)
      try {
        const cliente = await User.get(tituloParaAprovar.cliente_user_id);

        const todosTitulos = await Carteira.filter({ cliente_user_id: tituloParaAprovar.cliente_user_id });
        const hoje = new Date(`${hojeBR()}T00:00:00`);

        // Excluir o título atual (acabou de ser marcado como pago) e os
        // placeholders sem boleto, que nao sao divida cobravel.
        const titulosRestantes = (todosTitulos || [])
          .filter(t => t.id !== tituloParaAprovar.id && t.parcela_numero);

        const novoTotalVencido = titulosRestantes
          .filter(t => {
            if (t.status !== 'pendente') return false;
            if (!t.data_vencimento) return false;
            const dv = new Date(t.data_vencimento + 'T00:00:00');
            return dv < hoje;
          })
          .reduce((sum, t) => sum + (t.valor || 0), 0);

        // Auto-desbloqueio: se não tem mais títulos vencidos e foi bloqueio automático
        if (cliente.bloqueado && novoTotalVencido <= 0) {
          const isAutoBlock = cliente.motivo_bloqueio?.startsWith('Bloqueio automático');
          if (isAutoBlock) {
            await User.update(tituloParaAprovar.cliente_user_id, {
              bloqueado: false,
              motivo_bloqueio: null,
              data_bloqueio: null
            });
          }
        }

        // Auto-desbloqueio por loja: verificar se a loja do título deve ser desbloqueada
        if (tituloParaAprovar.loja_id) {
          try {
            const titulosLoja = titulosRestantes.filter(t => t.loja_id === tituloParaAprovar.loja_id);
            const totalVencidoLoja = titulosLoja
              .filter(t => {
                if (t.status !== 'pendente') return false;
                if (!t.data_vencimento) return false;
                const dv = new Date(t.data_vencimento + 'T00:00:00');
                return dv < hoje;
              })
              .reduce((sum, t) => sum + (t.valor || 0), 0);

            if (totalVencidoLoja <= 0) {
              const loja = await Loja.get(tituloParaAprovar.loja_id);
              if (loja?.bloqueada && loja.motivo_bloqueio?.startsWith('Bloqueio automático')) {
                await Loja.update(tituloParaAprovar.loja_id, {
                  bloqueada: false,
                  motivo_bloqueio: null,
                  data_bloqueio: null
                });
              }
            }
          } catch (e) {
            console.warn('Erro ao verificar desbloqueio da loja:', e);
          }
        }
      } catch (e) {
        console.warn('Erro ao atualizar totais do cliente:', e);
      }

      // 3. Verificar se todos os títulos do pedido foram pagos (não bloqueia aprovação se falhar)
      try {
        if (tituloParaAprovar.pedido_id) {
          const pedido = await Pedido.get(tituloParaAprovar.pedido_id);
          const titulosDoPedido = await Carteira.filter({ pedido_id: tituloParaAprovar.pedido_id });
          const todosPagos = titulosDoPedido.every(t => t.status === 'pago' || t.id === tituloParaAprovar.id);

          if (todosPagos && pedido.status_pagamento !== 'pago') {
            await Pedido.update(pedido.id, {
              status_pagamento: 'pago',
              data_pagamento: dataPagamentoConfirmada
            });
          }

          // Transição automática: pendente_pagamento → finalizado quando todas parcelas pagas
          if (todosPagos && pedido.status === 'pendente_pagamento') {
            await Pedido.update(pedido.id, { status: 'finalizado' });
          }
        }
      } catch (e) {
        console.warn('Erro ao atualizar status do pedido:', e);
      }

      // 4. Notificação ao cliente é disparada automaticamente pelo webhook notify-pedido
      toast.success('Comprovante aprovado!');
      setShowAprovacaoModal(false);
      setTituloParaAprovar(null);
      setDataPagamentoConfirmada('');
      loadData();
    } catch (_error) {
      toast.error('Erro ao aprovar comprovante');
    }
  };

  // Função para abrir modal de recusa
  const handleIniciarRecusa = (titulo) => {
    setTituloParaRecusar(titulo);
    setMotivoRecusa('');
    setShowRecusaModal(true);
  };

  // Função para confirmar recusa do comprovante
  const handleConfirmarRecusa = async () => {
    if (!motivoRecusa.trim()) {
      toast.error('Por favor, informe o motivo da recusa.');
      return;
    }

    setProcessandoRecusa(true);
    try {
      // Atualizar título: voltar status para pendente e limpar comprovante para reenvio
      await Carteira.update(tituloParaRecusar.id, {
        comprovante_analisado: true,
        comprovante_aprovado: false,
        motivo_recusa_comprovante: motivoRecusa.trim(),
        status: 'pendente',
        comprovante_url: null,
        comprovante_data_upload: null,
        data_pagamento_informada: null
      });

      // Atualizar status_pagamento do pedido de volta para pendente se necessário
      try {
        if (tituloParaRecusar.pedido_id) {
          const pedido = await Pedido.get(tituloParaRecusar.pedido_id);
          if (pedido.status_pagamento === 'em_analise' || pedido.status_pagamento === 'pago') {
            await Pedido.update(pedido.id, {
              status_pagamento: 'pendente'
            });
          }
          // Reversão: finalizado → pendente_pagamento quando comprovante é recusado
          if (pedido.status === 'finalizado') {
            await Pedido.update(pedido.id, { status: 'pendente_pagamento' });
          }
        }
      } catch (e) {
        console.warn('Erro ao atualizar status do pedido:', e);
      }

      // Notificação ao cliente é disparada automaticamente pelo webhook notify-pedido
      toast.success('Comprovante recusado. Cliente notificado.');
      setShowRecusaModal(false);
      setTituloParaRecusar(null);
      setMotivoRecusa('');
      loadData();
    } catch (_error) {
      toast.error('Erro ao recusar comprovante');
    } finally {
      setProcessandoRecusa(false);
    }
  };

  const getStatusInfo = (titulo) => {
    // Se já está pago, retornar status pago independente da data
    if (titulo.status === 'pago') {
      return { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    }

    // Se está em análise, mostrar esse status
    if (titulo.status === 'em_analise') {
      return { label: 'Em Análise', color: 'bg-blue-100 text-blue-800', icon: Clock };
    }

    if (!titulo.data_vencimento) {
      return { label: 'Sem vencimento', color: 'bg-gray-100 text-gray-700', icon: Clock };
    }

    // Normalizar datas para comparação (ignorar horário)
    const hoje = new Date(`${hojeBR()}T00:00:00`);
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(titulo.data_vencimento + 'T00:00:00');
    const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return { label: `Vencido há ${Math.abs(diffDias)} dias`, color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }

    if (diffDias === 0) {
      return { label: 'Vence hoje', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }

    if (diffDias <= 2) {
      return { label: `Vence em ${diffDias} dia(s)`, color: 'bg-orange-100 text-orange-800', icon: AlertTriangle };
    }

    if (diffDias <= 7) {
      return { label: `Vence em ${diffDias} dias`, color: 'bg-yellow-100 text-yellow-800', icon: Clock };
    }

    return { label: 'Pendente', color: 'bg-blue-100 text-blue-800', icon: Clock };
  };

  // Função para calcular número da parcela (X de Y). A ordem vem da view (por
  // vencimento, entre os titulos do mesmo pedido): a pagina nao tem mais todos
  // os titulos na memoria. O cliente nunca via os provisorios sem
  // parcela_numero, entao a conta dele e so entre os cobraveis.
  const getParcelaInfo = (titulo) => {
    if (!titulo.pedido_id) return null;
    // Fornecedor tambem conta so entre as parcelas: o provisorio nao e dele
    // na tela (ver montarConsultaTitulos).
    if (recorte?.tipo === 'cliente' || recorte?.tipo === 'fornecedor') {
      return {
        numeroParcela: Number(titulo.parcela_ordem_cobraveis) || 0,
        totalParcelas: Number(titulo.parcela_total_cobraveis) || 0
      };
    }
    return {
      numeroParcela: Number(titulo.parcela_ordem) || 0,
      totalParcelas: Number(titulo.parcela_total) || 0
    };
  };

  // Função para abrir modal de detalhes do pedido: o pedido completo e as
  // parcelas dele so agora, sob demanda (antes vinham todos na abertura).
  const handleVerDetalhesPedido = async (titulo) => {
    try {
      let q = supabase
        .from('carteira_com_pedido')
        .select('id,pedido_id,status,valor,data_vencimento,comprovante_url,comprovante_analisado')
        .eq('pedido_id', titulo.pedido_id);
      if (recorte?.tipo === 'cliente') {
        q = q.eq('cliente_user_id', recorte.clienteId).eq('cobravel_cliente', true);
        if (recorte.lojaId) q = q.eq('loja_id', recorte.lojaId);
      } else if (recorte?.tipo === 'fornecedor') {
        q = q.eq('fornecedor_id', recorte.fornecedorId).not('parcela_numero', 'is', null);
      }
      const [pedido, parcelas] = await Promise.all([
        Pedido.get(titulo.pedido_id),
        q.then(({ data, error }) => { if (error) throw error; return data || []; })
      ]);
      setTitulosPedidoSelecionado(parcelas);
      setPedidoSelecionado(pedido);
      setShowDetalhesModal(true);
    } catch (_e) {
      toast.error('Pedido não encontrado');
    }
  };

  const getFornecedorNome = (titulo) => {
    // Primeiro tenta pelo fornecedor_id do título
    if (titulo.fornecedor_id) {
      const fornecedor = fornecedores.find(f => f.id === titulo.fornecedor_id);
      if (fornecedor) {
        return fornecedor.razao_social || fornecedor.nome_fantasia || fornecedor.nome_marca;
      }
    }
    // Se não encontrou, tenta pelo pedido associado
    if (titulo.pedido_id && titulo.pedido_fornecedor_id) {
      const fornecedor = fornecedores.find(f => f.id === titulo.pedido_fornecedor_id);
      if (fornecedor) {
        return fornecedor.razao_social || fornecedor.nome_fantasia || fornecedor.nome_marca;
      }
    }
    return 'Polo Wear';
  };

  // Nome do cliente como a tela mostrava: so para fornecedor e admin.
  const nomeCliente = (titulo) => (podeVerNomeCliente() ? titulo.cliente_nome || null : null);

  const handleExport = async (format) => {
    try {
      // A lista e paginada; o export continua levando TODOS os do filtro.
      const filteredData = await carregarTodosFiltrados();

      if (!filteredData || filteredData.length === 0) {
        toast.info('Não há dados para exportar');
        return;
      }

      // Preparar dados para exportação
      const exportData = filteredData.map(titulo => {
        // Calcular status de exibição
        // Vencido = vencimento antes de hoje (Brasilia); sem data nao e vencido.
        const isVencido = !!titulo.data_vencimento && titulo.data_vencimento < hojeBR()
          && titulo.status === 'pendente';

        // Tipo: mostrar "Recebido" quando pago, senão traduzir o tipo original
        const tipoLabel = titulo.status === 'pago'
          ? 'Recebido'
          : titulo.tipo === 'a_receber' ? 'A Receber'
          : titulo.tipo === 'a_pagar' ? 'A Pagar'
          : titulo.tipo || '-';

        // Nome do cliente
        const clienteNome = titulo.cliente_user_id && nomeCliente(titulo)
          ? nomeCliente(titulo)
          : (user?.tipo_negocio === 'multimarca' || user?.tipo_negocio === 'franqueado')
            ? (user.empresa || user.razao_social || user.full_name || '-')
            : '-';

        // Número do pedido
        const numeroPedido = titulo.pedido_id ? `#${titulo.pedido_id.slice(-8).toUpperCase()}` : '-';

        return {
          numero_pedido: numeroPedido,
          cliente: clienteNome,
          fornecedor: getFornecedorNome(titulo),
          descricao: titulo.descricao || '-',
          tipo: tipoLabel,
          valor: titulo.valor || 0,
          vencimento: formatDate(titulo.data_vencimento),
          pagamento: titulo.data_pagamento ? formatDate(titulo.data_pagamento) : '-',
          status: titulo.status === 'pago' ? 'Pago' : isVencido ? 'Vencido' : titulo.status === 'em_analise' ? 'Em Análise' : 'Pendente',
          observacoes: titulo.observacoes || '-'
        };
      });

      // Definir colunas
      const columns = [
        { key: 'numero_pedido', label: 'Pedido' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'descricao', label: 'Descrição' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'valor', label: 'Valor (R$)', type: 'money' },
        { key: 'vencimento', label: 'Vencimento' },
        { key: 'pagamento', label: 'Pagamento' },
        { key: 'status', label: 'Status' },
        { key: 'observacoes', label: 'Obs.' }
      ];

      if (format === 'pdf') {
        exportToPDF(
          exportData,
          columns,
          'Carteira Financeira - Polo Wear',
          `carteira_financeira_${hojeBR()}.pdf`,
          { orientation: 'landscape' }
        );
      } else if (format === 'csv') {
        exportToCSV(
          exportData,
          columns,
          `carteira_financeira_${hojeBR()}.csv`
        );
      }
    } catch (_error) {
      toast.error('Erro ao exportar dados.');
    }
  };

  // Função para toggle de filtro (adiciona ou remove do array)
  const toggleFiltroStatus = (status) => {
    setFiltrosStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleFiltroFornecedor = (fornecedorId) => {
    setFiltrosFornecedor(prev =>
      prev.includes(fornecedorId)
        ? prev.filter(f => f !== fornecedorId)
        : [...prev, fornecedorId]
    );
  };

  const limparFiltros = () => {
    setFiltrosStatus([]);
    setFiltrosFornecedor([]);
    setPesquisaPedido('');
    setFiltroVencimentoDe('');
    setFiltroVencimentoAte('');
    setFiltroEmissaoDe('');
    setFiltroEmissaoAte('');
    setFiltroFaturamentoDe('');
    setFiltroFaturamentoAte('');
  };

  // A filtragem roda no servidor (montarConsultaTitulos): aqui ja e a pagina.
  const filteredTitulos = titulos;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / POR_PAGINA));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-6">
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Carteira Financeira</h1>
          <p className="text-gray-600">Gerencie seus pagamentos e recebimentos</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleExport('pdf')}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            onClick={() => handleExport('csv')}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Conferencia de cobranca: nota x pedido x titulos */}
      {(() => {
        const acima = conferencia.filter(c => c.situacao === 'faturado_acima_do_pedido');
        const foraDaNota = conferencia.filter(c => c.situacao === 'titulos_fora_da_nota');
        const centavos = conferencia.filter(c => c.situacao === 'arredondamento');
        if (acima.length === 0 && foraDaNota.length === 0 && centavos.length === 0) return null;

        const grave = acima.length > 0;
        const algumProblema = grave || foraDaNota.length > 0;
        return (
          <Alert className={grave ? 'border-red-300 bg-red-50' : algumProblema ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}>
            <AlertTriangle className={`h-4 w-4 ${grave ? 'text-red-600' : algumProblema ? 'text-amber-600' : 'text-gray-500'}`} />
            <AlertDescription className={grave ? 'text-red-800' : algumProblema ? 'text-amber-900' : 'text-gray-700'}>

              {/* Nota maior que o pedido. Vem primeiro de proposito: aqui a
                  cobranca esta CERTA e a nota e que esta errada -- reemitir
                  boleto para "acertar" cobraria o cliente pelo que ele nao
                  comprou. Foi o que quase aconteceu com a NF 1199. */}
              {acima.length > 0 && (
                <>
                  <strong>
                    {acima.length === 1
                      ? '1 nota faturada acima do pedido'
                      : `${acima.length} notas faturadas acima do pedido`}
                  </strong>
                  <br />
                  <span className="text-xs">
                    A nota cobre mais do que o cliente comprou. Não reemita boleto para
                    “acertar”: isso cobraria a diferença dele. Confira a nota com o fornecedor.
                  </span>
                  <ul className="mt-2 space-y-1 text-sm">
                    {acima.map(d => (
                      <li key={d.faturamento_id}>
                        NF <strong>#{d.numero_nf}</strong> — pedido {formatCurrency(Number(d.valor_pedido))},
                        {' '}faturado {formatCurrency(Number(d.total_faturado))}
                        {' '}(<strong>{formatCurrency(Number(d.excesso_faturado))} a mais</strong>)
                        {d.titulos_pagos > 0 && (
                          <span className="text-xs"> · {d.titulos_pagos} de {d.titulos} título(s) já pago(s)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Nota coerente com o pedido, mas a cobranca nao bate com ela. */}
              {foraDaNota.length > 0 && (
                <div className={acima.length > 0 ? 'mt-3 pt-3 border-t border-current/20' : ''}>
                  <strong>
                    {foraDaNota.length === 1
                      ? '1 nota com cobrança fora do valor'
                      : `${foraDaNota.length} notas com cobrança fora do valor`}
                  </strong>
                  <br />
                  <span className="text-xs">
                    A nota bate com o pedido, mas a soma dos títulos não bate com a nota.
                  </span>
                  <ul className="mt-2 space-y-1 text-sm">
                    {foraDaNota.map(d => (
                      <li key={d.faturamento_id}>
                        NF <strong>#{d.numero_nf}</strong> — nota {formatCurrency(Number(d.valor_nota))},
                        {' '}títulos {formatCurrency(Number(d.soma_titulos))}
                        {' '}(<strong>{Number(d.diferenca_titulos) > 0 ? 'falta' : 'excede'} {formatCurrency(Math.abs(Number(d.diferenca_titulos)))}</strong>)
                        {d.titulos_pagos > 0 && (
                          <span className="text-xs"> · {d.titulos_pagos} de {d.titulos} já pago(s)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {centavos.length > 0 && (
                <p className={`text-xs ${algumProblema ? 'mt-3 opacity-80' : ''}`}>
                  {algumProblema ? 'Há também ' : 'Conferência de cobrança: tudo certo, fora '}
                  {centavos.length} nota(s) com diferença de centavos — resíduo da divisão antiga
                  de parcelas, sem ação necessária.
                </p>
              )}
            </AlertDescription>
          </Alert>
        );
      })()}

      {/* Alertas de Vencimento */}
      {stats.proximosVencimentos > 0 && (user?.tipo_negocio === 'multimarca' || user?.tipo_negocio === 'franqueado') && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Atenção!</strong> Você tem {stats.proximosVencimentos} título(s) vencendo nos próximos 7 dias.
          </AlertDescription>
        </Alert>
      )}

      {stats.totalVencido > 0 && (user?.tipo_negocio === 'multimarca' || user?.tipo_negocio === 'franqueado') && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Títulos Vencidos!</strong> Total vencido: R$ {stats.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Total em Aberto</p>
            <p className="text-2xl font-bold text-blue-600">
              R$ {stats.totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-sm text-gray-600">Total Vencido</p>
            <p className="text-2xl font-bold text-red-600">
              R$ {stats.totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-sm text-gray-600">Próximos Vencimentos</p>
            <p className="text-2xl font-bold text-orange-600">
              {stats.proximosVencimentos}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">Total Pago</p>
            <p className="text-2xl font-bold text-green-600">
              R$ {stats.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-6 space-y-4">
          {/* Pesquisa por pedido */}
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-md">
              <Label>Pesquisar por Pedido</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Ex: A1B2C3D4"
                  value={pesquisaPedido}
                  onChange={(e) => setPesquisaPedido(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {(filtrosStatus.length > 0 || filtrosFornecedor.length > 0 || pesquisaPedido || filtroVencimentoDe || filtroVencimentoAte || filtroEmissaoDe || filtroEmissaoAte || filtroFaturamentoDe || filtroFaturamentoAte) && (
              <Button
                variant="outline"
                size="sm"
                onClick={limparFiltros}
                className="text-gray-600"
              >
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Filtros por data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Vencimento do Título</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filtroVencimentoDe} onChange={(e) => setFiltroVencimentoDe(e.target.value)} title="Vencimento De" />
                <Input type="date" value={filtroVencimentoAte} onChange={(e) => setFiltroVencimentoAte(e.target.value)} title="Vencimento Até" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Emissão do Pedido</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filtroEmissaoDe} onChange={(e) => setFiltroEmissaoDe(e.target.value)} title="Emissão De" />
                <Input type="date" value={filtroEmissaoAte} onChange={(e) => setFiltroEmissaoAte(e.target.value)} title="Emissão Até" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Faturamento do Pedido</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filtroFaturamentoDe} onChange={(e) => setFiltroFaturamentoDe(e.target.value)} title="Faturamento De" />
                <Input type="date" value={filtroFaturamentoAte} onChange={(e) => setFiltroFaturamentoAte(e.target.value)} title="Faturamento Até" />
              </div>
            </div>
          </div>

          {/* Filtros Dropdown */}
          <div className="flex flex-wrap gap-2 items-center">
            <MultiSelectFilter
              label="Status"
              options={[
                { value: 'pendente', label: 'Pendentes' },
                { value: 'vencidos', label: 'Vencidos' },
                { value: 'sem_vencimento', label: 'Sem vencimento' },
                { value: 'pago', label: 'Pagos' },
                { value: 'em_analise', label: 'Em Análise' }
              ]}
              selected={filtrosStatus}
              onToggle={toggleFiltroStatus}
              onClear={() => setFiltrosStatus([])}
            />
            {fornecedores.length > 0 && (
              <MultiSelectFilter
                label="Fornecedor"
                options={fornecedores.map(f => ({
                  value: f.id,
                  label: f.razao_social || f.nome_fantasia || f.nome_marca
                }))}
                selected={filtrosFornecedor}
                onToggle={toggleFiltroFornecedor}
                onClear={() => setFiltrosFornecedor([])}
              />
            )}
          </div>

          {/* Indicador de filtros ativos */}
          {(filtrosStatus.length > 0 || filtrosFornecedor.length > 0 || filtroVencimentoDe || filtroVencimentoAte || filtroEmissaoDe || filtroEmissaoAte || filtroFaturamentoDe || filtroFaturamentoAte) && (
            <div className="text-sm text-gray-500">
              Mostrando {totalFiltrado} de {stats.totalTitulos} títulos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Títulos */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Títulos ({totalFiltrado})
            {carregandoLista && <span className="text-xs font-normal text-gray-500">carregando…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTitulos.map(titulo => {
              const statusInfo = getStatusInfo(titulo);
              const StatusIcon = statusInfo.icon;
              const parcelaInfo = getParcelaInfo(titulo);
              const numeroPedido = titulo.pedido_id ? titulo.pedido_id.slice(-8).toUpperCase() : null;

              return (
                <div key={titulo.id} className="p-4 bg-white rounded-lg shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      {/* Linha com número do pedido e parcela */}
                      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                        {numeroPedido && (
                          <span className="font-medium text-gray-700">
                            Pedido #{numeroPedido}
                          </span>
                        )}
                        {parcelaInfo && (
                          <Badge variant="secondary" className="text-xs">
                            Parcela {parcelaInfo.numeroParcela} de {parcelaInfo.totalParcelas}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        {(user?.tipo_negocio === 'fornecedor' || user?.role === 'admin') && titulo.cliente_user_id && nomeCliente(titulo) && (
                          <Badge variant="outline" className="bg-blue-50">
                            {nomeCliente(titulo)}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {getFornecedorNome(titulo)}
                        </Badge>
                      </div>

                      <div className="grid md:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Valor:</span>
                          <span className="font-bold ml-2">{formatCurrency(titulo.valor)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vencimento:</span>
                          <span className="ml-2">{new Date(titulo.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                        {titulo.data_pagamento && (
                          <div>
                            <span className="text-gray-600">Pago em:</span>
                            <span className="ml-2">{new Date(titulo.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>

                      {/* Comprovante da Carteira */}
                      {titulo.comprovante_url && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          {titulo.comprovante_analisado ? (
                            titulo.comprovante_aprovado ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Comprovante Aprovado
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Comprovante Recusado
                              </Badge>
                            )
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Aguardando Análise
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirUrlSegura(titulo.comprovante_url)}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            Ver Comprovante
                          </Button>
                        </div>
                      )}

                      {titulo.motivo_recusa_comprovante && (
                        <Alert className="mt-2 border-red-200 bg-red-50">
                          <AlertDescription className="text-red-800 text-sm">
                            <strong>Motivo da recusa:</strong> {titulo.motivo_recusa_comprovante}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* Botão Ver Detalhes do Pedido */}
                      {titulo.pedido_id && titulo.pedido_encontrado_id && (
                        <Button
                          onClick={() => handleVerDetalhesPedido(titulo)}
                          size="sm"
                          variant="outline"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Pedido
                        </Button>
                      )}

                      {/* Botão Enviar Comprovante (clientes, título pendente) */}
                      {(user?.tipo_negocio === 'multimarca' || user?.tipo_negocio === 'franqueado') && titulo.status === 'pendente' && (
                        <Button
                          onClick={() => {
                            setSelectedTitulo(titulo);
                            setShowUploadModal(true);
                          }}
                          size="sm"
                          className="bg-blue-600"
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Enviar Comprovante
                        </Button>
                      )}

                      {/* Botões de aprovação/recusa para admin e fornecedor */}
                      {(user?.role === 'admin' || user?.tipo_negocio === 'fornecedor') && titulo.comprovante_url && !titulo.comprovante_analisado && (
                        <>
                          <Button
                            onClick={() => handleIniciarAprovacao(titulo)}
                            size="sm"
                            className="bg-green-600"
                          >
                            Aprovar
                          </Button>
                          <Button
                            onClick={() => handleIniciarRecusa(titulo)}
                            size="sm"
                            variant="destructive"
                          >
                            Recusar
                          </Button>
                        </>
                      )}

                      {/* Registrar como pago (admin/fornecedor): marca a parcela
                          paga direto, sem depender de comprovante do cliente.
                          Usado para conciliar boleto pago no banco. So aparece
                          quando NAO ha um comprovante aguardando analise (nesse
                          caso usa-se Aprovar). */}
                      {(user?.role === 'admin' || user?.tipo_negocio === 'fornecedor') &&
                        (titulo.status === 'pendente' || titulo.status === 'em_analise') &&
                        !(titulo.comprovante_url && !titulo.comprovante_analisado) && (
                        <Button
                          onClick={() => handleIniciarAprovacao(titulo)}
                          size="sm"
                          className="bg-green-600"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Registrar como pago
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTitulos.length === 0 && !carregandoLista && (
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum título encontrado</p>
              </div>
            )}
          </div>

          {totalFiltrado > POR_PAGINA && (
            <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
              <span>
                {pagina * POR_PAGINA + 1}–{Math.min((pagina + 1) * POR_PAGINA, totalFiltrado)} de {totalFiltrado}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina === 0 || carregandoLista}
                  onClick={() => setPagina(p => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <span className="self-center">Página {pagina + 1} de {totalPaginas}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina + 1 >= totalPaginas || carregandoLista}
                  onClick={() => setPagina(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Upload de Comprovante */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTitulo && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Valor:</p>
                <p className="text-2xl font-bold">{formatCurrency(selectedTitulo.valor)}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Vencimento: {new Date(selectedTitulo.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            <div>
              <Label>Data do Pagamento *</Label>
              <Input
                type="date"
                value={dataPagamentoInformada}
                onChange={(e) => setDataPagamentoInformada(e.target.value)}
                className="mt-2"
                max={hojeBR()}
              />
              <p className="text-xs text-gray-500 mt-1">
                Informe a data em que o pagamento foi realizado
              </p>
            </div>

            <div>
              <Label>Selecione o comprovante *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovanteFile(e.target.files[0])}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                <strong>Formatos aceitos:</strong> PDF, JPG, JPEG, PNG
              </p>
            </div>

            <Alert>
              <AlertDescription>
                Após enviar o comprovante, ele será analisado pelo departamento financeiro.
                Você receberá uma notificação quando for aprovado ou recusado.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setComprovanteFile(null);
                  setDataPagamentoInformada('');
                  setSelectedTitulo(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadComprovante}
                disabled={!comprovanteFile || !dataPagamentoInformada || uploadingComprovante}
                className="bg-blue-600"
              >
                {uploadingComprovante ? 'Enviando...' : 'Enviar Comprovante'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação de Comprovante */}
      <Dialog open={showAprovacaoModal} onOpenChange={setShowAprovacaoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              {tituloParaAprovar?.comprovante_url ? 'Aprovar Comprovante' : 'Registrar Pagamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tituloParaAprovar && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className="font-bold">{formatCurrency(tituloParaAprovar.valor)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-600">Vencimento:</span>
                  <span>{new Date(tituloParaAprovar.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
                {tituloParaAprovar.data_pagamento_informada && (
                  <div className="flex justify-between items-center mt-2 text-blue-600">
                    <span className="text-sm">Data informada pelo cliente:</span>
                    <span className="font-medium">{new Date(tituloParaAprovar.data_pagamento_informada + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {tituloParaAprovar.comprovante_url && (
                  <div className="mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => abrirUrlSegura(tituloParaAprovar.comprovante_url)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Visualizar Comprovante
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Data do Pagamento Confirmada *</Label>
              <Input
                type="date"
                value={dataPagamentoConfirmada}
                onChange={(e) => setDataPagamentoConfirmada(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Confirme ou ajuste a data de pagamento após verificar o comprovante
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAprovacaoModal(false);
                  setTituloParaAprovar(null);
                  setDataPagamentoConfirmada('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarAprovacao}
                disabled={!dataPagamentoConfirmada}
                className="bg-green-600"
              >
                Confirmar Aprovação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Recusa de Comprovante */}
      <Dialog open={showRecusaModal} onOpenChange={setShowRecusaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Recusar Comprovante
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {tituloParaRecusar && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Valor do título:</span>
                  <span className="font-bold text-lg">{formatCurrency(tituloParaRecusar.valor)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Vencimento:</span>
                  <span>{new Date(tituloParaRecusar.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
                {tituloParaRecusar.comprovante_url && (
                  <div className="mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => abrirUrlSegura(tituloParaRecusar.comprovante_url)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Visualizar Comprovante Enviado
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="motivoRecusa" className="text-sm font-medium">
                Motivo da Recusa *
              </Label>
              <Textarea
                id="motivoRecusa"
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Descreva o motivo da recusa do comprovante (ex: valor incorreto, comprovante ilegível, data não confere, etc.)"
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-gray-500">
                Este motivo será enviado ao cliente por e-mail para que ele possa enviar um novo comprovante.
              </p>
            </div>

            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 text-sm">
                <strong>Atenção:</strong> Ao recusar, o cliente será notificado e poderá enviar um novo comprovante.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRecusaModal(false);
                  setTituloParaRecusar(null);
                  setMotivoRecusa('');
                }}
                disabled={processandoRecusa}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarRecusa}
                disabled={processandoRecusa || !motivoRecusa.trim()}
                variant="destructive"
              >
                {processandoRecusa ? 'Processando...' : 'Confirmar Recusa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Pedido */}
      <Dialog open={showDetalhesModal} onOpenChange={setShowDetalhesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Detalhes do Pedido #{pedidoSelecionado?.id?.slice(-8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {pedidoSelecionado && (
            <div className="space-y-4 py-4">
              {/* Informações básicas do pedido */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Status do Pedido</p>
                  <p className="font-medium capitalize">
                    {pedidoSelecionado.status?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Data do Pedido</p>
                  <p className="font-medium">
                    {pedidoSelecionado.created_date
                      ? new Date(pedidoSelecionado.created_date).toLocaleDateString('pt-BR')
                      : '-'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Valor Total</p>
                  <p className="font-bold text-lg text-blue-600">
                    {formatCurrency(pedidoSelecionado.valor_final || pedidoSelecionado.valor_total || 0)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Forma de Pagamento</p>
                  <p className="font-medium capitalize">
                    {pedidoSelecionado.metodo_pagamento?.replace(/_/g, ' ') || '-'}
                  </p>
                </div>
              </div>

              {/* Parcelas do pedido */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Parcelas deste Pedido</h4>
                <div className="space-y-2">
                  {titulosPedidoSelecionado
                    .filter(t => t.pedido_id === pedidoSelecionado.id)
                    .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))
                    .map((titulo, index, arr) => {
                      const statusParcela = getStatusInfo(titulo);
                      const StatusIconParcela = statusParcela.icon;
                      return (
                        <div key={titulo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              Parcela {index + 1}/{arr.length}
                            </span>
                            <Badge className={statusParcela.color} variant="secondary">
                              <StatusIconParcela className="w-3 h-3 mr-1" />
                              {statusParcela.label}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(titulo.valor)}</p>
                            <p className="text-xs text-gray-500">
                              Venc: {new Date(titulo.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Itens do pedido */}
              {pedidoSelecionado.itens && pedidoSelecionado.itens.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Itens do Pedido</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pedidoSelecionado.itens.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          {item.imagem && (
                            <img src={thumb(item.imagem, 40)} alt={item.nome} width={40} height={40} loading="lazy" decoding="async" onError={usarOriginalSeFalhar(item.imagem)} className="w-10 h-10 object-cover rounded" />
                          )}
                          <div>
                            <p className="font-medium">{item.nome || item.produto_nome}</p>
                            {item.variante && (
                              <p className="text-xs text-gray-500">
                                {item.variante.cor && `Cor: ${item.variante.cor}`}
                                {item.variante.tamanho && ` | Tam: ${item.variante.tamanho}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p>{item.quantidade}x {formatCurrency(item.preco_unitario || item.preco)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rastreamento */}
              {(pedidoSelecionado.transportadora || pedidoSelecionado.codigo_rastreio) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Rastreamento</h4>
                  <div className="space-y-2">
                    {pedidoSelecionado.transportadora && (
                      <p className="text-sm text-gray-700">
                        <strong>Transportadora:</strong> {pedidoSelecionado.transportadora}
                      </p>
                    )}
                    {pedidoSelecionado.codigo_rastreio && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-700">
                          <strong>Código de Rastreio:</strong>{' '}
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded select-all">
                            {pedidoSelecionado.codigo_rastreio}
                          </span>
                        </p>
                      </div>
                    )}
                    {pedidoSelecionado.link_rastreio && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirUrlSegura(pedidoSelecionado.link_rastreio)}
                        className="w-full"
                      >
                        Rastrear Pedido
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDetalhesModal(false);
                    setPedidoSelecionado(null);
                  }}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}