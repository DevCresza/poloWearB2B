
import { useState, useEffect } from 'react';
import { Pedido } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Package, Clock, CheckCircle, Truck, X, Eye, FileText,
  Download, CreditCard, Calendar, MapPin, Receipt, Upload,
  AlertTriangle, ArrowUpCircle, DollarSign
} from 'lucide-react';
import { formatCurrency, exportToCSV, exportToPDF, formatDate, toBrasiliaDateString } from '@/utils/exportUtils';
import PedidoDetailsModal from '@/components/pedidos/PedidoDetailsModal';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import { useLojaContext } from '@/contexts/LojaContext';
import { Loja } from '@/api/entities';
import { Store } from 'lucide-react';

export default function MeusPedidos() {
  const { lojaSelecionada, lojas, loading: lojasLoading } = useLojaContext();
  const [lojasMap, setLojasMap] = useState({});
  const [pedidos, setPedidos] = useState([]);
  const [carteira, setCarteira] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFinanceiroModal, setShowFinanceiroModal] = useState(false);
  const [showComprovanteModal, setShowComprovanteModal] = useState(false);
  const [selectedTitulo, setSelectedTitulo] = useState(null);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosStatus, setFiltrosStatus] = useState([]); // Array para múltipla seleção
  const [filtroEmissaoDe, setFiltroEmissaoDe] = useState('');
  const [filtroEmissaoAte, setFiltroEmissaoAte] = useState('');
  const [filtroFaturamentoDe, setFiltroFaturamentoDe] = useState('');
  const [filtroFaturamentoAte, setFiltroFaturamentoAte] = useState('');
  const [filtroVencimentoDe, setFiltroVencimentoDe] = useState('');
  const [filtroVencimentoAte, setFiltroVencimentoAte] = useState('');
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [dataPagamentoComprovante, setDataPagamentoComprovante] = useState('');

  // Estados para confirmação com data
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);
  const [tipoConfirmacao, setTipoConfirmacao] = useState('');
  const [pedidoConfirmacao, setPedidoConfirmacao] = useState(null);
  const [dataConfirmacao, setDataConfirmacao] = useState('');

  useEffect(() => {
    if (lojasLoading) return;
    loadData();
  }, [lojaSelecionada?.id, lojasLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();

      // Build filter based on loja selection
      const pedidoFilter = { comprador_user_id: currentUser.id };
      const carteiraFilter = { cliente_user_id: currentUser.id };
      if (lojaSelecionada) {
        pedidoFilter.loja_id = lojaSelecionada.id;
        carteiraFilter.loja_id = lojaSelecionada.id;
      }

      const [pedidosList, fornecedoresList, carteiraList] = await Promise.all([
        Pedido.filter(pedidoFilter, '-created_date'),
        Fornecedor.list(),
        Carteira.filter(carteiraFilter)
      ]);

      // Build lojas map for display
      if (lojas.length > 0) {
        const map = {};
        lojas.forEach(l => { map[l.id] = l.nome_fantasia || l.nome; });
        setLojasMap(map);
      }

      // Filtrar pedidos para mostrar:
      // - Pedidos em andamento (antes de faturar ou ainda não entregues)
      // - Pedidos já faturados mas com parcelas pendentes (para acompanhamento)
      // - NÃO mostra cancelados (vão para histórico)
      // - NÃO mostra finalizados com todas parcelas pagas (vão para histórico)
      const pedidosFiltrados = (pedidosList || []).filter(pedido => {
        // Pedidos cancelados vão para histórico
        if (pedido.status === 'cancelado') return false;

        // Pedidos finalizados só aparecem se ainda há parcelas pendentes
        if (pedido.status === 'finalizado') {
          const parcelasPendentes = (carteiraList || []).filter(
            t => t.pedido_id === pedido.id && (t.status === 'pendente' || t.status === 'em_analise')
          );
          return parcelasPendentes.length > 0;
        }

        // Pedidos em andamento sempre aparecem
        return true;
      });

      setUser(currentUser);
      setPedidos(pedidosFiltrados);
      setFornecedores(fornecedoresList || []);
      setCarteira(carteiraList || []);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      novo_pedido: { 
        label: 'Pedido Recebido', 
        color: 'bg-blue-100 text-blue-800', 
        icon: Clock,
        description: 'Seu pedido foi recebido e está aguardando análise do fornecedor'
      },
      em_analise: { 
        label: 'Em Análise', 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: Clock,
        description: 'O fornecedor está analisando seu pedido'
      },
      aprovado: { 
        label: 'Aprovado', 
        color: 'bg-green-100 text-green-800', 
        icon: CheckCircle,
        description: 'Seu pedido foi aprovado e entrará em produção'
      },
      recusado: { 
        label: 'Recusado', 
        color: 'bg-red-100 text-red-800', 
        icon: X,
        description: 'Pedido recusado pelo fornecedor'
      },
      em_producao: { 
        label: 'Em Produção', 
        color: 'bg-purple-100 text-purple-800', 
        icon: Package,
        description: 'Seu pedido está sendo produzido/separado'
      },
      faturado: { 
        label: 'Faturado', 
        color: 'bg-indigo-100 text-indigo-800', 
        icon: FileText,
        description: 'Nota fiscal e boleto disponíveis para download'
      },
      em_transporte: {
        label: 'Em Transporte',
        color: 'bg-orange-100 text-orange-800',
        icon: Truck,
        description: 'Seu pedido foi enviado e está a caminho'
      },
      pendente_pagamento: {
        label: 'Aguardando Pagamento',
        color: 'bg-amber-100 text-amber-800',
        icon: DollarSign,
        description: 'Pedido entregue, aguardando confirmação de pagamento'
      },
      finalizado: {
        label: 'Finalizado',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
        description: 'Pedido entregue e pago com sucesso'
      },
      cancelado: { 
        label: 'Cancelado', 
        color: 'bg-gray-100 text-gray-800', 
        icon: X,
        description: 'Pedido cancelado'
      }
    };
    return statusMap[status] || statusMap.novo_pedido;
  };

  const getPaymentStatusInfo = (status) => {
    const statusMap = {
      pendente: { label: 'Pagamento Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      em_analise: { label: 'Comprovante em Análise', color: 'bg-blue-100 text-blue-800', icon: Clock },
      pago: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      atrasado: { label: 'Pagamento Atrasado', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
      cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: X }
    };
    return statusMap[status] || statusMap.pendente;
  };

  // Abrir modal de confirmação com data
  const abrirConfirmacao = (pedido, tipo) => {
    setPedidoConfirmacao(pedido);
    setTipoConfirmacao(tipo);
    setDataConfirmacao('');
    setShowConfirmacaoModal(true);
  };

  const handleConfirmacao = async () => {
    if (!dataConfirmacao) {
      toast.info('Informe a data de recebimento');
      return;
    }

    try {
      const updateData = {};

      if (tipoConfirmacao === 'boleto') {
        updateData.cliente_confirmou_boleto = true;
        updateData.data_confirmacao_boleto = dataConfirmacao;
      } else if (tipoConfirmacao === 'nf') {
        updateData.cliente_confirmou_nf = true;
        updateData.data_confirmacao_nf = dataConfirmacao;
      } else if (tipoConfirmacao === 'recebimento') {
        updateData.cliente_confirmou_recebimento = true;
        updateData.data_confirmacao_recebimento = dataConfirmacao;

        // Transição de status: em_transporte → pendente_pagamento ou finalizado
        if (pedidoConfirmacao.status === 'em_transporte') {
          const titulosDoPedido = await Carteira.filter({ pedido_id: pedidoConfirmacao.id });
          const parcelasReais = (titulosDoPedido || []).filter(t => t.parcela_numero);
          const todasPagas = parcelasReais.length > 0
            ? parcelasReais.every(t => t.status === 'pago')
            : pedidoConfirmacao.status_pagamento === 'pago';
          updateData.status = todasPagas ? 'finalizado' : 'pendente_pagamento';
        }
      }

      await Pedido.update(pedidoConfirmacao.id, updateData);
      toast.success('Confirmação registrada com sucesso!');
      setShowConfirmacaoModal(false);
      setPedidoConfirmacao(null);
      setTipoConfirmacao('');
      setDataConfirmacao('');
      loadData();

      if (showDetailsModal) {
        const pedidoAtualizado = await Pedido.get(pedidoConfirmacao.id);
        setSelectedPedido(pedidoAtualizado);
      }
    } catch (_error) {
      toast.error('Erro ao registrar confirmação. Tente novamente.');
    }
  };

  const handleUploadComprovante = async (tituloId, file) => {
    setUploadingComprovante(true);
    try {
      // Upload do arquivo
      const { file_url } = await UploadFile({ file });

      // Atualizar título com comprovante
      await Carteira.update(tituloId, {
        comprovante_url: file_url,
        comprovante_data_upload: new Date().toISOString(),
        status: 'em_analise',
        comprovante_analisado: false
      });

      toast.success('Comprovante enviado com sucesso! Aguarde análise do financeiro.');
      loadData();
      setShowFinanceiroModal(false);
    } catch (_error) {
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingComprovante(false);
    }
  };

  // Enviar comprovante - funciona para pedido inteiro ou título individual
  const handleEnviarComprovantePedido = async () => {
    if (!comprovanteFile) {
      toast.info('Selecione o arquivo do comprovante');
      return;
    }

    if (!dataPagamentoComprovante) {
      toast.info('Informe a data em que o pagamento foi realizado');
      return;
    }

    setUploadingComprovante(true);
    try {
      const { file_url } = await UploadFile({ file: comprovanteFile });

      if (selectedTitulo) {
        // Upload para título individual (vindo da Carteira Financeira)
        await Carteira.update(selectedTitulo.id, {
          comprovante_url: file_url,
          comprovante_data_upload: new Date().toISOString(),
          comprovante_analisado: false,
          data_pagamento_informada: dataPagamentoComprovante,
          status: 'em_analise'
        });
        toast.success('Comprovante da parcela enviado! Aguarde a análise.');
      } else if (selectedPedido) {
        // Upload para pedido - atualiza apenas o pedido, não as parcelas individuais.
        // Cada parcela deve ter seu comprovante enviado individualmente.
        await Pedido.update(selectedPedido.id, {
          comprovante_pagamento_url: file_url,
          comprovante_pagamento_data: new Date().toISOString(),
          status_pagamento: 'em_analise'
        });
        toast.success('Comprovante enviado! Aguarde a análise do financeiro.');
      }

      setShowComprovanteModal(false);
      setComprovanteFile(null);
      setDataPagamentoComprovante('');
      setSelectedPedido(null);
      setSelectedTitulo(null);
      loadData();
    } catch (_error) {
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingComprovante(false);
    }
  };

  const getFornecedorNome = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    return fornecedor ? (fornecedor.razao_social || fornecedor.nome_fantasia || fornecedor.nome_marca) : 'N/A';
  };

  const handleExportCSV = () => {
    const exportData = filteredPedidos.map(pedido => {
      const statusInfo = getStatusInfo(pedido.status);
      const paymentInfo = getPaymentStatusInfo(pedido.status_pagamento);
      const itens = Array.isArray(pedido.itens) ? pedido.itens : JSON.parse(pedido.itens || '[]');
      const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);

      return {
        numero_pedido: `#${pedido.id.slice(-8).toUpperCase()}`,
        fornecedor: getFornecedorNome(pedido.fornecedor_id),
        data_pedido: formatDate(pedido.created_date),
        status: statusInfo.label,
        status_pagamento: paymentInfo.label,
        metodo_pagamento: pedido.metodo_pagamento?.replace('_', ' ').toUpperCase() || '',
        quantidade_itens: totalItens,
        valor_total: pedido.valor_total,
        data_prevista_entrega: pedido.data_prevista_entrega ? formatDate(pedido.data_prevista_entrega) : '',
        codigo_rastreio: pedido.codigo_rastreio || '',
        transportadora: pedido.transportadora || ''
      };
    });

    const columns = [
      { key: 'numero_pedido', label: 'Nº Pedido' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'data_pedido', label: 'Data do Pedido' },
      { key: 'status', label: 'Status' },
      { key: 'status_pagamento', label: 'Status Pagamento' },
      { key: 'metodo_pagamento', label: 'Método Pagamento' },
      { key: 'quantidade_itens', label: 'Qtd. Itens' },
      { key: 'valor_total', label: 'Valor Total (R$)' },
      { key: 'data_prevista_entrega', label: 'Previsão Entrega' },
      { key: 'codigo_rastreio', label: 'Código Rastreio' },
      { key: 'transportadora', label: 'Transportadora' }
    ];

    exportToCSV(
      exportData,
      columns,
      `meus_pedidos_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const handleExportPDF = () => {
    const exportData = filteredPedidos.map(pedido => {
      const statusInfo = getStatusInfo(pedido.status);
      const paymentInfo = getPaymentStatusInfo(pedido.status_pagamento);
      const itens = Array.isArray(pedido.itens) ? pedido.itens : JSON.parse(pedido.itens || '[]');
      const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);

      return {
        numero_pedido: `#${pedido.id.slice(-8).toUpperCase()}`,
        fornecedor: getFornecedorNome(pedido.fornecedor_id),
        data_pedido: formatDate(pedido.created_date),
        status: statusInfo.label,
        status_pagamento: paymentInfo.label,
        quantidade_itens: totalItens,
        valor_total: formatCurrency(pedido.valor_final || pedido.valor_total)
      };
    });

    const columns = [
      { key: 'numero_pedido', label: 'Nº Pedido' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'data_pedido', label: 'Data' },
      { key: 'status', label: 'Status' },
      { key: 'status_pagamento', label: 'Pagamento' },
      { key: 'quantidade_itens', label: 'Qtd.' },
      { key: 'valor_total', label: 'Valor Total' }
    ];

    exportToPDF(
      exportData,
      columns,
      `Meus Pedidos - ${user?.empresa || user?.full_name || 'Cliente'}`,
      `meus_pedidos_${new Date().toISOString().split('T')[0]}.pdf`
    );
  };

  // Função para toggle de filtro (adiciona ou remove do array)
  const toggleFiltroStatus = (status) => {
    setFiltrosStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const limparFiltros = () => {
    setFiltrosStatus([]);
    setSearchTerm('');
    setFiltroEmissaoDe('');
    setFiltroEmissaoAte('');
    setFiltroFaturamentoDe('');
    setFiltroFaturamentoAte('');
    setFiltroVencimentoDe('');
    setFiltroVencimentoAte('');
  };

  const hasDateFilters = filtroEmissaoDe || filtroEmissaoAte || filtroFaturamentoDe || filtroFaturamentoAte || filtroVencimentoDe || filtroVencimentoAte;

  const filteredPedidos = pedidos.filter(pedido => {
    const matchesSearch = pedido.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getFornecedorNome(pedido.fornecedor_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filtrosStatus.length === 0 || filtrosStatus.includes(pedido.status);

    // Filtro por data de emissão do pedido (created_date)
    let matchesEmissao = true;
    if (filtroEmissaoDe || filtroEmissaoAte) {
      const dataEmissao = toBrasiliaDateString(pedido.created_date);
      if (dataEmissao) {
        if (filtroEmissaoDe && dataEmissao < filtroEmissaoDe) matchesEmissao = false;
        if (filtroEmissaoAte && dataEmissao > filtroEmissaoAte) matchesEmissao = false;
      } else {
        matchesEmissao = false;
      }
    }

    // Filtro por data de faturamento (nf_data_upload)
    let matchesFaturamento = true;
    if (filtroFaturamentoDe || filtroFaturamentoAte) {
      const dataFat = toBrasiliaDateString(pedido.nf_data_upload);
      if (dataFat) {
        if (filtroFaturamentoDe && dataFat < filtroFaturamentoDe) matchesFaturamento = false;
        if (filtroFaturamentoAte && dataFat > filtroFaturamentoAte) matchesFaturamento = false;
      } else {
        matchesFaturamento = false;
      }
    }

    // Filtro por data de vencimento (parcelas na carteira)
    let matchesVencimento = true;
    if (filtroVencimentoDe || filtroVencimentoAte) {
      const parcelasDoPedido = carteira.filter(t => t.pedido_id === pedido.id && t.parcela_numero);
      if (parcelasDoPedido.length > 0) {
        // Pedido passa se alguma parcela estiver no range de vencimento
        matchesVencimento = parcelasDoPedido.some(p => {
          if (filtroVencimentoDe && p.data_vencimento < filtroVencimentoDe) return false;
          if (filtroVencimentoAte && p.data_vencimento > filtroVencimentoAte) return false;
          return true;
        });
      } else {
        matchesVencimento = false;
      }
    }

    return matchesSearch && matchesStatus && matchesEmissao && matchesFaturamento && matchesVencimento;
  });

  // Calcular totais financeiros
  const totalEmAberto = carteira
    .filter(t => t.tipo === 'a_receber' && t.status === 'pendente')
    .reduce((sum, t) => sum + t.valor, 0);
    
  const totalVencido = carteira
    .filter(t => {
      const hoje = new Date();
      const vencimento = new Date(t.data_vencimento);
      return t.tipo === 'a_receber' && t.status === 'pendente' && vencimento < hoje;
    })
    .reduce((sum, t) => sum + t.valor, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
        .shadow-neumorphic-inset { box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff; }
      `}</style>

      {/* Header com Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Pedidos</p>
                <p className="text-3xl font-bold text-blue-600">{pedidos.length}</p>
              </div>
              <Package className="w-12 h-12 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valor em Aberto</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {formatCurrency(totalEmAberto)}
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valores Vencidos</p>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(totalVencido)}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Bloqueio */}
      {user?.bloqueado && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Atenção:</strong> Sua conta está bloqueada por inadimplência. 
            {user.motivo_bloqueio && ` Motivo: ${user.motivo_bloqueio}`}
            <br />
            Regularize seus pagamentos para continuar fazendo pedidos.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-4 space-y-4">
          {/* Linha de pesquisa e ações */}
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Buscar por ID do pedido ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-xl shadow-neumorphic-inset"
            />

            {(filtrosStatus.length > 0 || searchTerm || hasDateFilters) && (
              <Button
                variant="outline"
                size="sm"
                onClick={limparFiltros}
                className="text-gray-600 rounded-xl"
              >
                Limpar Filtros
              </Button>
            )}

            <Button
              onClick={() => setShowFinanceiroModal(true)}
              className="bg-green-600 hover:bg-green-700 rounded-xl"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Carteira Financeira
            </Button>

            <Button
              onClick={handleExportPDF}
              variant="outline"
              className="rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Filtros por data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Emissão do Pedido</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Label className="text-[10px] text-gray-400 absolute -top-1.5 left-2 bg-slate-100 px-1 z-10">De</Label>
                  <Input type="date" value={filtroEmissaoDe} onChange={(e) => setFiltroEmissaoDe(e.target.value)} title="Emissão De" className="rounded-xl shadow-neumorphic-inset" />
                </div>
                <div className="relative">
                  <Label className="text-[10px] text-gray-400 absolute -top-1.5 left-2 bg-slate-100 px-1 z-10">Até</Label>
                  <Input type="date" value={filtroEmissaoAte} onChange={(e) => setFiltroEmissaoAte(e.target.value)} title="Emissão Até" className="rounded-xl shadow-neumorphic-inset" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Faturamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Label className="text-[10px] text-gray-400 absolute -top-1.5 left-2 bg-slate-100 px-1 z-10">De</Label>
                  <Input type="date" value={filtroFaturamentoDe} onChange={(e) => setFiltroFaturamentoDe(e.target.value)} title="Faturamento De" className="rounded-xl shadow-neumorphic-inset" />
                </div>
                <div className="relative">
                  <Label className="text-[10px] text-gray-400 absolute -top-1.5 left-2 bg-slate-100 px-1 z-10">Até</Label>
                  <Input type="date" value={filtroFaturamentoAte} onChange={(e) => setFiltroFaturamentoAte(e.target.value)} title="Faturamento Até" className="rounded-xl shadow-neumorphic-inset" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Vencimento do Título</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Label className="text-[10px] text-gray-400 absolute -top-1.5 left-2 bg-slate-100 px-1 z-10">De</Label>
                  <Input type="date" value={filtroVencimentoDe} onChange={(e) => setFiltroVencimentoDe(e.target.value)} title="Vencimento De" className="rounded-xl shadow-neumorphic-inset" />
                </div>
                <div className="relative">
                  <Label className="text-[10px] text-gray-400 absolute -top-1.5 left-2 bg-slate-100 px-1 z-10">Até</Label>
                  <Input type="date" value={filtroVencimentoAte} onChange={(e) => setFiltroVencimentoAte(e.target.value)} title="Vencimento Até" className="rounded-xl shadow-neumorphic-inset" />
                </div>
              </div>
            </div>
          </div>

          {/* Filtros de Status com dropdown multi-select */}
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              label="Status"
              options={[
                { value: 'novo_pedido', label: 'Novos', color: 'bg-blue-500' },
                { value: 'em_analise', label: 'Em Análise', color: 'bg-yellow-500' },
                { value: 'aprovado', label: 'Aprovados', color: 'bg-green-500' },
                { value: 'em_producao', label: 'Em Produção', color: 'bg-purple-500' },
                { value: 'faturado', label: 'Faturados', color: 'bg-indigo-500' },
                { value: 'em_transporte', label: 'Em Transporte', color: 'bg-orange-500' },
                { value: 'pendente_pagamento', label: 'Aguardando Pagamento', color: 'bg-amber-500' },
                { value: 'finalizado', label: 'Finalizados', color: 'bg-emerald-500' }
              ]}
              selected={filtrosStatus}
              onToggle={toggleFiltroStatus}
              onClear={() => setFiltrosStatus([])}
            />

            {/* Indicador de resultados */}
            {(filtrosStatus.length > 0 || searchTerm || hasDateFilters) && (
              <span className="text-sm text-gray-500">
                {filteredPedidos.length} de {pedidos.length} pedidos
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {filteredPedidos.length === 0 ? (
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum pedido encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm || filtrosStatus.length > 0
                  ? 'Tente ajustar os filtros de busca.'
                  : 'Você ainda não realizou nenhum pedido.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPedidos.map((pedido) => {
            const statusInfo = getStatusInfo(pedido.status);
            const paymentInfo = getPaymentStatusInfo(pedido.status_pagamento);
            
            return (
              <Card key={pedido.id} className="bg-slate-100 rounded-2xl shadow-neumorphic hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Informações Principais */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            Pedido #{pedido.id.slice(-8).toUpperCase()}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {getFornecedorNome(pedido.fornecedor_id)}
                          </p>
                          {pedido.loja_id && lojasMap[pedido.loja_id] && (
                            <Badge variant="outline" className="mt-1 text-xs bg-blue-50">
                              <Store className="w-3 h-3 mr-1" />
                              {lojasMap[pedido.loja_id]}
                            </Badge>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Realizado em {formatDate(pedido.created_date)}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(pedido.valor_total)}
                          </p>
                          <Badge className={`mt-2 ${statusInfo.color}`}>
                            <statusInfo.icon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      {/* Status de Pagamento */}
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-500" />
                        <Badge className={paymentInfo.color}>
                          <paymentInfo.icon className="w-3 h-3 mr-1" />
                          {paymentInfo.label}
                        </Badge>
                        {pedido.metodo_pagamento && (
                          <span className="text-sm text-gray-600">
                            • {pedido.metodo_pagamento.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Informações de Entrega */}
                      {pedido.data_prevista_entrega && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Previsão de entrega: {new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}

                      {pedido.codigo_rastreio && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Truck className="w-4 h-4 text-orange-600" />
                          <span className="text-gray-600">Rastreio:</span>
                          <code className="bg-gray-200 px-2 py-1 rounded">{pedido.codigo_rastreio}</code>
                          {pedido.link_rastreio ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs rounded-lg"
                              onClick={() => window.open(pedido.link_rastreio, '_blank')}
                            >
                              <Truck className="w-3 h-3 mr-1" />
                              Rastrear Pedido
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">(Link não disponível)</span>
                          )}
                        </div>
                      )}

                      {/* Alertas e Ações */}
                      <div className="flex flex-wrap gap-2">
                        {['faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'].includes(pedido.status) && pedido.nf_url && !pedido.cliente_confirmou_nf && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirConfirmacao(pedido, 'nf')}
                            className="rounded-lg"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Recebimento da NF
                          </Button>
                        )}

                        {['faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'].includes(pedido.status) && pedido.boleto_url && !pedido.cliente_confirmou_boleto && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirConfirmacao(pedido, 'boleto')}
                            className="rounded-lg"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Recebimento do Boleto
                          </Button>
                        )}

                        {['em_transporte', 'pendente_pagamento', 'finalizado'].includes(pedido.status) && !pedido.cliente_confirmou_recebimento && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirConfirmacao(pedido, 'recebimento')}
                            className="rounded-lg bg-green-50 hover:bg-green-100"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Recebimento do Produto
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 lg:w-48">
                      <Button
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setShowDetailsModal(true);
                        }}
                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>
                      
                      {pedido.nf_url && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(pedido.nf_url, '_blank')}
                          className="w-full rounded-xl"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar NF
                        </Button>
                      )}
                      
                      {pedido.boleto_url && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(pedido.boleto_url, '_blank')}
                          className="w-full rounded-xl"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Boleto
                        </Button>
                      )}

                      {/* Comprovantes devem ser enviados por parcela via Carteira Financeira ou Ver Detalhes */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {showDetailsModal && selectedPedido && (
        <PedidoDetailsModal
          pedido={selectedPedido}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPedido(null);
          }}
          onUpdate={() => {
            loadData();
            // Recarregar o pedido selecionado para atualizar o modal
            Pedido.get(selectedPedido.id).then(pedidoAtualizado => {
              setSelectedPedido(pedidoAtualizado);
            });
          }}
          currentUser={user}
          fornecedorMap={new Map(fornecedores.map(f => [f.id, f.razao_social || f.nome_fantasia || f.nome_marca]))}
        />
      )}

      {/* Modal de Carteira Financeira */}
      {showFinanceiroModal && (
        <Dialog open={showFinanceiroModal} onOpenChange={setShowFinanceiroModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Carteira Financeira</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Total em Aberto</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {formatCurrency(totalEmAberto)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Valores Vencidos</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(totalVencido)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Títulos */}
              <div className="space-y-3">
                {carteira.filter(t => t.tipo === 'a_receber').length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum título financeiro encontrado
                  </div>
                ) : (
                  carteira
                    .filter(t => t.tipo === 'a_receber')
                    .map((titulo) => {
                      // Normalizar datas para comparação (ignorar horário)
                      const vencimento = new Date(titulo.data_vencimento + 'T00:00:00');
                      const hoje = new Date();
                      hoje.setHours(0, 0, 0, 0);
                      const vencido = vencimento < hoje && titulo.status === 'pendente';
                      
                      return (
                        <Card key={titulo.id} className={vencido ? 'border-red-300 bg-red-50' : ''}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-semibold">
                                    Pedido #{titulo.pedido_id ? titulo.pedido_id.slice(-8).toUpperCase() : 'N/A'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Vencimento: {vencimento.toLocaleDateString('pt-BR')}
                                  </p>
                                  {vencido && (
                                    <Badge className="bg-red-600 text-white mt-1">
                                      <AlertTriangle className="w-3 h-3 mr-1" />
                                      Vencido
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-2xl font-bold text-blue-600">
                                  {formatCurrency(titulo.valor)}
                                </p>
                                
                                {titulo.status === 'em_analise' && (
                                  <Badge className="bg-blue-100 text-blue-800">
                                    Comprovante em análise
                                  </Badge>
                                )}
                                
                                {titulo.status === 'pago' && (
                                  <Badge className="bg-green-100 text-green-800">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Pago
                                  </Badge>
                                )}
                              </div>
                              
                              {titulo.status === 'pendente' && (
                                <Button
                                  onClick={() => {
                                    setSelectedTitulo(titulo);
                                    setSelectedPedido(null);
                                    setShowFinanceiroModal(false);
                                    setShowComprovanteModal(true);
                                  }}
                                  disabled={uploadingComprovante}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Enviar Comprovante
                                </Button>
                              )}
                              
                              {titulo.comprovante_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(titulo.comprovante_url, '_blank')}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver Comprovante
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Comprovantes são enviados por parcela via Carteira Financeira ou Ver Detalhes */}

      {/* Modal de Confirmação com Data */}
      <Dialog open={showConfirmacaoModal} onOpenChange={setShowConfirmacaoModal}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {tipoConfirmacao === 'nf' && 'Confirmar Recebimento da NF'}
              {tipoConfirmacao === 'boleto' && 'Confirmar Recebimento do Boleto'}
              {tipoConfirmacao === 'recebimento' && 'Confirmar Recebimento do Produto'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pedidoConfirmacao && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  Pedido #{pedidoConfirmacao.id.slice(-8).toUpperCase()}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                {tipoConfirmacao === 'recebimento' ? 'Data de Recebimento do Produto *' :
                 tipoConfirmacao === 'nf' ? 'Data de Recebimento da NF *' :
                 'Data de Recebimento do Boleto *'}
              </label>
              <Input
                type="date"
                value={dataConfirmacao}
                onChange={(e) => setDataConfirmacao(e.target.value)}
                className="rounded-xl"
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500 mt-1">
                Informe a data em que você recebeu {tipoConfirmacao === 'recebimento' ? 'o produto' : tipoConfirmacao === 'nf' ? 'a nota fiscal' : 'o boleto'}
              </p>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Esta data serve como registro oficial de recebimento. Preencha com a data correta para evitar divergências.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmacaoModal(false);
                  setPedidoConfirmacao(null);
                  setTipoConfirmacao('');
                  setDataConfirmacao('');
                }}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmacao}
                disabled={!dataConfirmacao}
                className="bg-green-600 hover:bg-green-700 rounded-xl"
              >
                Confirmar Recebimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
