import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { SendEmail, UploadFile } from '@/api/integrations';
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

export default function CarteiraFinanceira() {
  const [user, setUser] = useState(null);
  const [titulos, setTitulos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
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
    totalPago: 0
  });
  const [pedidosMap, setPedidosMap] = useState({});

  // Estado para pesquisa por número de pedido
  const [pesquisaPedido, setPesquisaPedido] = useState('');

  // Estado para modal de detalhes do pedido
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // Função para sincronizar totais do cliente com base nos títulos reais da carteira
  const sincronizarTotaisCliente = async (clienteId, titulosList) => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Calcular total em aberto (pendente ou em_analise)
      const totalEmAberto = titulosList
        .filter(t => t.status === 'pendente' || t.status === 'em_analise')
        .reduce((sum, t) => sum + (t.valor || 0), 0);

      // Calcular total vencido (pendente E data vencimento < hoje)
      const totalVencido = titulosList
        .filter(t => {
          if (t.status !== 'pendente') return false;
          const dataVencimento = new Date(t.data_vencimento + 'T00:00:00');
          return dataVencimento < hoje;
        })
        .reduce((sum, t) => sum + (t.valor || 0), 0);

      // Buscar dados atuais do cliente
      const cliente = await User.get(clienteId);

      // Só atualizar se houver diferença (evita requisições desnecessárias)
      const totalEmAbertoAtual = cliente.total_em_aberto || 0;
      const totalVencidoAtual = cliente.total_vencido || 0;

      if (Math.abs(totalEmAberto - totalEmAbertoAtual) > 0.01 ||
          Math.abs(totalVencido - totalVencidoAtual) > 0.01) {
        await User.update(clienteId, {
          total_em_aberto: totalEmAberto,
          total_vencido: totalVencido
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar totais:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let titulosList = [];
      let fornecedoresList = [];

      if (currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'franqueado') {
        // Cliente vê títulos associados a ele, exceto de pedidos ainda não aprovados
        const todosOsTitulos = await Carteira.filter({
          cliente_user_id: currentUser.id
        }, '-data_vencimento') || [];

        // Filtrar:
        // 1. Remover placeholders (sem parcela_numero) - criados pelo Carrinho antes do fornecedor preencher dados de pagamento
        // 2. Remover títulos de pedidos ainda não aprovados (novo_pedido)
        const titulosComParcela = todosOsTitulos.filter(t => t.parcela_numero);

        const pedidoIds = [...new Set(titulosComParcela.map(t => t.pedido_id).filter(Boolean))];
        if (pedidoIds.length > 0) {
          const pedidosPromises = pedidoIds.map(id => Pedido.get(id).catch(() => null));
          const pedidosResults = await Promise.all(pedidosPromises);
          const pedidosNaoAprovados = new Set(
            pedidosResults.filter(p => p && p.status === 'novo_pedido').map(p => p.id)
          );
          titulosList = titulosComParcela.filter(t => !t.pedido_id || !pedidosNaoAprovados.has(t.pedido_id));
        } else {
          titulosList = titulosComParcela;
        }
      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Usar fornecedor_id do usuário diretamente (se disponível)
        // ou buscar fornecedor pelo responsavel_user_id (fallback para usuários antigos)
        let fornecedorId = currentUser.fornecedor_id;
        let fornecedor = null;

        if (fornecedorId) {
          // Buscar dados do fornecedor pelo ID
          fornecedor = await Fornecedor.get(fornecedorId);
        } else {
          // Fallback: buscar fornecedor pelo responsavel_user_id
          const fornecedoresListTemp = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
          fornecedor = fornecedoresListTemp[0];
          if (fornecedor) {
            fornecedorId = fornecedor.id;
          }
        }

        if (fornecedor) {
          // Fornecedor vê títulos dos seus pedidos
          titulosList = await Carteira.filter({
            fornecedor_id: fornecedorId
          }, '-data_vencimento');
        } else {
          titulosList = [];
        }
      } else if (currentUser.role === 'admin') {
        // Admin vê tudo
        titulosList = await Carteira.list('-data_vencimento');
      }

      fornecedoresList = await Fornecedor.list();

      setTitulos(titulosList || []);
      setFornecedores(fornecedoresList || []);

      // Carregar nomes dos clientes para fornecedor/admin
      if (currentUser.tipo_negocio === 'fornecedor' || currentUser.role === 'admin') {
        const clienteIds = [...new Set((titulosList || []).map(t => t.cliente_user_id).filter(Boolean))];
        if (clienteIds.length > 0) {
          const clientesPromises = clienteIds.map(id => User.get(id).catch(() => null));
          const clientesResults = await Promise.all(clientesPromises);
          const map = {};
          clientesResults.forEach(c => {
            if (c) map[c.id] = c.empresa || c.razao_social || c.nome_marca || c.full_name || 'Cliente';
          });
          setClientesMap(map);
        }
      }

      // Recalcular e sincronizar totais do cliente (apenas títulos de pedidos finalizados)
      if ((currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'franqueado') && titulosList) {
        await sincronizarTotaisCliente(currentUser.id, titulosList);
      }

      // Carregar pedidos relacionados para mostrar comprovantes
      if (titulosList && titulosList.length > 0) {
        const pedidoIds = [...new Set(titulosList.map(t => t.pedido_id).filter(Boolean))];
        const pedidosPromises = pedidoIds.map(id => Pedido.get(id).catch(() => null));
        const pedidosResults = await Promise.all(pedidosPromises);
        const pedidosMapTemp = {};
        pedidosResults.forEach(p => {
          if (p) pedidosMapTemp[p.id] = p;
        });
        setPedidosMap(pedidosMapTemp);
      }

      calculateStats(titulosList);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (titulosList) => {
    const hoje = new Date();
    const proximos7Dias = new Date();
    proximos7Dias.setDate(hoje.getDate() + 7);

    const totalAberto = titulosList
      .filter(t => t.status === 'pendente')
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    const totalVencido = titulosList
      .filter(t => {
        const vencimento = new Date(t.data_vencimento);
        return t.status === 'pendente' && vencimento < hoje;
      })
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    const proximosVencimentos = titulosList
      .filter(t => {
        const vencimento = new Date(t.data_vencimento);
        return t.status === 'pendente' && vencimento >= hoje && vencimento <= proximos7Dias;
      })
      .length;

    const totalPago = titulosList
      .filter(t => t.status === 'pago')
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    setStats({
      totalAberto,
      totalVencido,
      proximosVencimentos,
      totalPago
    });
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
      const uploadResult = await UploadFile({ file: comprovanteFile });

      // Atualizar título com comprovante e data informada
      await Carteira.update(selectedTitulo.id, {
        comprovante_url: uploadResult.file_url,
        comprovante_data_upload: new Date().toISOString(),
        comprovante_analisado: false,
        data_pagamento_informada: dataPagamentoInformada,
        status: 'em_analise'
      });

      // Enviar notificação ao fornecedor
      const pedido = await Pedido.get(selectedTitulo.pedido_id);
      await SendEmail({
        to: 'financeiro@polomultimarca.com.br',
        subject: `Comprovante de Pagamento - Pedido #${pedido.id.slice(-8).toUpperCase()}`,
        body: `
          Um novo comprovante de pagamento foi enviado pelo cliente.

          Cliente: ${user.empresa || user.full_name}
          Pedido: #${pedido.id.slice(-8).toUpperCase()}
          Valor: ${formatCurrency(selectedTitulo.valor)}
          Vencimento: ${new Date(selectedTitulo.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
          Data do Pagamento Informada: ${new Date(dataPagamentoInformada + 'T12:00:00').toLocaleDateString('pt-BR')}

          Comprovante: ${uploadResult.file_url}
        `
      });

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
    setDataPagamentoConfirmada(titulo.data_pagamento_informada || new Date().toISOString().split('T')[0]);
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

      // 2. Atualizar totais do cliente (não bloqueia aprovação se falhar)
      try {
        const cliente = await User.get(tituloParaAprovar.cliente_user_id);
        const novoTotalAberto = (cliente.total_em_aberto || 0) - tituloParaAprovar.valor;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataVencimento = new Date(tituloParaAprovar.data_vencimento + 'T00:00:00');
        const estaVencido = dataVencimento < hoje;

        const novoTotalVencido = estaVencido
          ? (cliente.total_vencido || 0) - tituloParaAprovar.valor
          : (cliente.total_vencido || 0);

        await User.update(tituloParaAprovar.cliente_user_id, {
          total_em_aberto: Math.max(0, novoTotalAberto),
          total_vencido: Math.max(0, novoTotalVencido)
        });
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
        }
      } catch (e) {
        console.warn('Erro ao atualizar status do pedido:', e);
      }

      // 4. Notificar cliente por email (não bloqueia aprovação se falhar)
      try {
        const cliente = await User.get(tituloParaAprovar.cliente_user_id);
        if (cliente?.email) {
          const pedidoId = tituloParaAprovar.pedido_id ? `#${tituloParaAprovar.pedido_id.slice(-8).toUpperCase()}` : '';
          await SendEmail({
            to: cliente.email,
            subject: `Comprovante Aprovado${pedidoId ? ` - Pedido ${pedidoId}` : ''}`,
            body: `Seu comprovante de pagamento foi aprovado!\n\n${pedidoId ? `Pedido: ${pedidoId}\n` : ''}Valor: ${formatCurrency(tituloParaAprovar.valor)}\nData do Pagamento: ${new Date(dataPagamentoConfirmada + 'T12:00:00').toLocaleDateString('pt-BR')}`
          });
        }
      } catch (e) {
        console.warn('Erro ao enviar email de aprovação:', e);
      }

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
        }
      } catch (e) {
        console.warn('Erro ao atualizar status do pedido:', e);
      }

      // Notificar cliente (não bloqueia recusa se falhar)
      try {
        const cliente = await User.get(tituloParaRecusar.cliente_user_id);
        if (cliente?.email) {
          const pedidoId = tituloParaRecusar.pedido_id ? `#${tituloParaRecusar.pedido_id.slice(-8).toUpperCase()}` : '';
          await SendEmail({
            to: cliente.email,
            subject: `Comprovante Recusado${pedidoId ? ` - Pedido ${pedidoId}` : ''}`,
            body: `Seu comprovante de pagamento foi recusado.\n\nMotivo: ${motivoRecusa.trim()}\n\nPor favor, envie um novo comprovante.`
          });
        }
      } catch (e) {
        console.warn('Erro ao enviar email de recusa:', e);
      }

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

    // Normalizar datas para comparação (ignorar horário)
    const hoje = new Date();
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

  // Função para calcular número da parcela (X de Y)
  const getParcelaInfo = (titulo) => {
    if (!titulo.pedido_id) return null;

    // Buscar todos os títulos do mesmo pedido
    const titulosDoPedido = titulos
      .filter(t => t.pedido_id === titulo.pedido_id)
      .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

    const totalParcelas = titulosDoPedido.length;
    const numeroParcela = titulosDoPedido.findIndex(t => t.id === titulo.id) + 1;

    return { numeroParcela, totalParcelas };
  };

  // Função para abrir modal de detalhes do pedido
  const handleVerDetalhesPedido = (titulo) => {
    const pedido = pedidosMap[titulo.pedido_id];
    if (pedido) {
      setPedidoSelecionado(pedido);
      setShowDetalhesModal(true);
    } else {
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
    if (titulo.pedido_id && pedidosMap[titulo.pedido_id]?.fornecedor_id) {
      const fornecedor = fornecedores.find(f => f.id === pedidosMap[titulo.pedido_id].fornecedor_id);
      if (fornecedor) {
        return fornecedor.razao_social || fornecedor.nome_fantasia || fornecedor.nome_marca;
      }
    }
    return 'Polo Wear';
  };

  const handleExport = (format) => {
    try {
      const filteredData = filteredTitulos;

      if (!filteredData || filteredData.length === 0) {
        toast.info('Não há dados para exportar');
        return;
      }

      // Preparar dados para exportação
      const exportData = filteredData.map(titulo => {
        // Calcular status de exibição
        const vencimento = new Date(titulo.data_vencimento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const isVencido = vencimento < hoje && titulo.status === 'pendente';

        return {
          fornecedor: getFornecedorNome(titulo),
          descricao: titulo.descricao || '-',
          tipo: titulo.tipo || 'a_receber',
          valor: titulo.valor || 0,
          vencimento: formatDate(titulo.data_vencimento),
          pagamento: titulo.data_pagamento ? formatDate(titulo.data_pagamento) : '-',
          status: titulo.status === 'pago' ? 'Pago' : isVencido ? 'Vencido' : titulo.status === 'em_analise' ? 'Em Análise' : 'Pendente',
          categoria: titulo.categoria || '-',
          observacoes: titulo.observacoes || '-'
        };
      });

      // Definir colunas
      const columns = [
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'descricao', label: 'Descrição' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'valor', label: 'Valor (R$)' },
        { key: 'vencimento', label: 'Vencimento' },
        { key: 'pagamento', label: 'Data Pagamento' },
        { key: 'status', label: 'Status' },
        { key: 'categoria', label: 'Categoria' },
        { key: 'observacoes', label: 'Observações' }
      ];

      if (format === 'pdf') {
        exportToPDF(
          exportData,
          columns,
          'Carteira Financeira - Polo Wear',
          `carteira_financeira_${new Date().toISOString().split('T')[0]}.pdf`
        );
      } else if (format === 'csv') {
        exportToCSV(
          exportData,
          columns,
          `carteira_financeira_${new Date().toISOString().split('T')[0]}.csv`
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
  };

  const filteredTitulos = titulos.filter(titulo => {
    // Filtro por fornecedor (múltipla seleção)
    const matchesFornecedor = filtrosFornecedor.length === 0 || filtrosFornecedor.includes(titulo.fornecedor_id);

    // Filtro por número de pedido (cliente pode pesquisar pelo código)
    const numeroPedido = titulo.pedido_id ? titulo.pedido_id.slice(-8).toUpperCase() : '';
    const matchesPesquisa = !pesquisaPedido ||
      numeroPedido.includes(pesquisaPedido.toUpperCase()) ||
      titulo.pedido_id?.toLowerCase().includes(pesquisaPedido.toLowerCase());

    // Filtro por status (múltipla seleção)
    if (filtrosStatus.length === 0) {
      // Sem filtro de status = mostrar todos
      return matchesFornecedor && matchesPesquisa;
    }

    // Verificar se algum dos filtros de status selecionados corresponde
    let matchesStatus = false;

    for (const filtro of filtrosStatus) {
      if (filtro === 'vencidos') {
        // Tratamento especial para "vencidos" - não é um status real, é calculado
        const vencimento = new Date(titulo.data_vencimento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const isVencido = vencimento < hoje && titulo.status === 'pendente';
        if (isVencido) {
          matchesStatus = true;
          break;
        }
      } else if (titulo.status === filtro) {
        matchesStatus = true;
        break;
      }
    }

    return matchesStatus && matchesFornecedor && matchesPesquisa;
  });

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
            {(filtrosStatus.length > 0 || filtrosFornecedor.length > 0 || pesquisaPedido) && (
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

          {/* Filtros Dropdown */}
          <div className="flex flex-wrap gap-2 items-center">
            <MultiSelectFilter
              label="Status"
              options={[
                { value: 'pendente', label: 'Pendentes' },
                { value: 'vencidos', label: 'Vencidos' },
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
          {(filtrosStatus.length > 0 || filtrosFornecedor.length > 0) && (
            <div className="text-sm text-gray-500">
              Filtros ativos: {filtrosStatus.length + filtrosFornecedor.length} |
              Mostrando {filteredTitulos.length} de {titulos.length} títulos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Títulos */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader>
          <CardTitle>Títulos ({filteredTitulos.length})</CardTitle>
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
                        {(user?.tipo_negocio === 'fornecedor' || user?.role === 'admin') && titulo.cliente_user_id && clientesMap[titulo.cliente_user_id] && (
                          <Badge variant="outline" className="bg-blue-50">
                            {clientesMap[titulo.cliente_user_id]}
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
                            onClick={() => window.open(titulo.comprovante_url, '_blank')}
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
                      {titulo.pedido_id && pedidosMap[titulo.pedido_id] && (
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
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTitulos.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum título encontrado</p>
              </div>
            )}
          </div>
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
                max={new Date().toISOString().split('T')[0]}
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
              Aprovar Comprovante
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
                      onClick={() => window.open(tituloParaAprovar.comprovante_url, '_blank')}
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
                      onClick={() => window.open(tituloParaRecusar.comprovante_url, '_blank')}
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
                  {titulos
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
                            <img src={item.imagem} alt={item.nome} className="w-10 h-10 object-cover rounded" />
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
                        onClick={() => window.open(pedidoSelecionado.link_rastreio, '_blank')}
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