
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Package, Clock, CheckCircle, Truck, X, Eye, FileText,
  Download, CreditCard, Calendar, MapPin, Receipt, Upload,
  AlertTriangle, ArrowUpCircle, DollarSign
} from 'lucide-react';
import { formatCurrency, exportToCSV, exportToPDF, formatDate, toBrasiliaDateString, getMesFaturamentoItem, getMesesFaturamentoPedido, formatMesAno } from '@/utils/exportUtils';
import { Produto } from '@/api/entities';
import PedidoDetailsModal from '@/components/pedidos/PedidoDetailsModal';
import PedidoItensEditModal from '@/components/pedidos/PedidoItensEditModal';
import { Edit, Ban } from 'lucide-react';
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
  // produto_id -> data_prevista_entrega / acao, dos produtos que aparecem nos
  // pedidos deste cliente. Alimenta o Extrato Detalhado e o modal do pedido,
  // pra o cliente ver o MESMO mes de entrega que o admin ve.
  const [produtoEntregaMap, setProdutoEntregaMap] = useState(null);
  const [produtoAcaoMap, setProdutoAcaoMap] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showItensEditModal, setShowItensEditModal] = useState(false);
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
  const [filtroMesFaturamento, setFiltroMesFaturamento] = useState('todos'); // 'YYYY-MM'
  const [filtroVencimentoDe, setFiltroVencimentoDe] = useState('');
  const [filtroVencimentoAte, setFiltroVencimentoAte] = useState('');
  const [comprovanteFile, setComprovanteFile] = useState(null);
  const [dataPagamentoComprovante, setDataPagamentoComprovante] = useState('');

  // Estados para confirmação com data
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);
  const [tipoConfirmacao, setTipoConfirmacao] = useState('');
  const [pedidoConfirmacao, setPedidoConfirmacao] = useState(null);
  const [dataConfirmacao, setDataConfirmacao] = useState('');
  const [observacaoRecebimento, setObservacaoRecebimento] = useState('');

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

      // Filtrar pedidos: mostra todos exceto cancelados (que vão para histórico)
      const pedidosFiltrados = (pedidosList || []).filter(pedido => {
        if (pedido.status === 'cancelado') return false;
        return true;
      });

      setUser(currentUser);
      setPedidos(pedidosFiltrados);
      setFornecedores(fornecedoresList || []);
      setCarteira(carteiraList || []);

      // Busca so os produtos citados nos pedidos do cliente (nao a tabela toda).
      const produtoIds = [...new Set(
        pedidosFiltrados.flatMap(p => (Array.isArray(p.itens) ? p.itens : []).map(i => i?.produto_id))
      )].filter(Boolean);
      if (produtoIds.length > 0) {
        try {
          const produtosList = await Produto.listByIds(produtoIds);
          const entregaMap = {};
          const acaoMap = {};
          (produtosList || []).forEach(p => {
            if (p.data_prevista_entrega) entregaMap[p.id] = p.data_prevista_entrega;
            if (p.acao) acaoMap[p.id] = p.acao;
          });
          setProdutoEntregaMap(entregaMap);
          setProdutoAcaoMap(acaoMap);
        } catch (e) {
          console.warn('Erro ao carregar produtos dos pedidos:', e);
        }
      }
    } catch (error) {
      // Falha silenciosa aqui deixava a tela com "nenhum pedido", que o cliente
      // le como "meus pedidos sumiram".
      console.error('Erro ao carregar pedidos:', error);
      toast.error('Não foi possível carregar seus pedidos. Recarregue a página.');
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
      parcialmente_faturado: {
        label: 'Parcialmente Faturado',
        color: 'bg-cyan-100 text-cyan-800',
        icon: Package,
        description: 'Parte do seu pedido foi faturado, o restante está pendente'
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
        if (observacaoRecebimento.trim()) {
          updateData.observacao_recebimento = observacaoRecebimento.trim();
        }

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
      setObservacaoRecebimento('');
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
      const lojaName = pedido.loja_id && lojasMap[pedido.loja_id] ? lojasMap[pedido.loja_id] : '';

      return {
        numero_pedido: `#${pedido.id.slice(-8).toUpperCase()}`,
        fornecedor: getFornecedorNome(pedido.fornecedor_id),
        loja: lojaName,
        data_pedido: formatDate(pedido.created_date),
        data_faturamento: pedido.nf_data_upload ? formatDate(pedido.nf_data_upload) : '',
        nf_numero: pedido.nf_numero || '',
        status: statusInfo.label,
        status_pagamento: paymentInfo.label,
        metodo_pagamento: pedido.metodo_pagamento?.replace('_', ' ').toUpperCase() || '',
        quantidade_itens: totalItens,
        valor_total: pedido.valor_final || pedido.valor_total || 0,
        transportadora: pedido.transportadora || '',
        codigo_rastreio: pedido.codigo_rastreio || ''
      };
    });

    const columns = [
      { key: 'numero_pedido', label: 'Nº Pedido' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'loja', label: 'Loja' },
      { key: 'data_pedido', label: 'Data Pedido' },
      { key: 'data_faturamento', label: 'Data Faturamento' },
      { key: 'nf_numero', label: 'Nº NF' },
      { key: 'status', label: 'Status' },
      { key: 'status_pagamento', label: 'Status Pagamento' },
      { key: 'metodo_pagamento', label: 'Método Pagamento' },
      { key: 'quantidade_itens', label: 'Qtd. Itens' },
      { key: 'valor_total', label: 'Valor Total (R$)' },
      { key: 'transportadora', label: 'Transportadora' },
      { key: 'codigo_rastreio', label: 'Código Rastreio' }
    ];

    exportToCSV(
      exportData,
      columns,
      `meus_pedidos_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  // Extrato Detalhado: uma linha por ITEM, com mes de faturamento e acao —
  // mesma regra da extracao do admin, restrita aos pedidos deste cliente.
  // O CSV de pedidos e por PEDIDO e nao mostra nem produto nem mes.
  const handleExportExtratoItens = () => {
    try {
      const pgLabels = {
        pix: 'PIX',
        cartao_credito: 'Cartão de Crédito',
        boleto_faturado: 'Boleto Faturado',
        boleto: 'Boleto',
        transferencia: 'Transferência Bancária'
      };

      const linhas = [];
      for (const pedido of filteredPedidos) {
        let itens = pedido.itens || [];
        if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch { itens = []; } }
        if (!Array.isArray(itens) || itens.length === 0) continue;

        const numero = `#${pedido.id.slice(-8).toUpperCase()}`;
        const formaPg = pgLabels[pedido.metodo_pagamento] || pedido.metodo_pagamento || '';
        const prazos = pedido.boleto_prazos_dias;
        const formaPgComPrazo = (pedido.metodo_pagamento === 'boleto_faturado' && Array.isArray(prazos) && prazos.length)
          ? `${formaPg} (${prazos.join('/')} dias)`
          : formaPg;
        const dataPedido = pedido.created_date
          ? new Date(pedido.created_date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : '';

        for (const it of itens) {
          const isGrade = it.tipo_venda === 'grade' && (it.total_pecas_grade || 0) > 0;
          const totalItens = (it.quantidade || 0) * (isGrade ? (it.total_pecas_grade || 1) : 1);
          const precoBase = Number(it.preco) || 0;
          const precoTotal = Number(it.total) || precoBase * (it.quantidade || 0);
          // PRECO UNITARIO sempre por PECA (consistente com TOTAL DE ITENS).
          const precoUnit = isGrade ? precoBase / (it.total_pecas_grade || 1) : precoBase;

          linhas.push({
            numero_pedido: numero,
            data_pedido: dataPedido,
            loja: (pedido.loja_id && lojasMap[pedido.loja_id]) || '',
            fornecedor: getFornecedorNome(pedido.fornecedor_id),
            forma_pagamento: formaPgComPrazo,
            mes_faturamento: getMesFaturamentoItem(pedido, it, produtoEntregaMap || {}),
            acao: (it.produto_id && produtoAcaoMap[it.produto_id]) || '',
            tipo_pedido: isGrade ? 'PGM' : 'PE',
            nome_item: it.nome || '',
            ref_fornecedor: it.referencia_fornecedor || it.referencia || '',
            ref_linx: it.referencia_linx || it.referencia_polo || it.referencia || '',
            cor: it.cor_selecionada?.cor_nome || '',
            tamanho: it.tamanho_selecionado || '',
            preco_unitario: precoUnit,
            total_itens: totalItens,
            grades: isGrade ? (it.quantidade || 0) : '-',
            preco_total: precoTotal,
            nf_numero: pedido.nf_numero || '',
            status_pedido: getStatusInfo(pedido.status).label
          });
        }
      }

      if (linhas.length === 0) {
        toast.info('Não há itens para extrair nos pedidos filtrados');
        return;
      }

      const columns = [
        { key: 'numero_pedido', label: 'NÚMERO DO PEDIDO' },
        { key: 'data_pedido', label: 'DATA DO PEDIDO' },
        { key: 'loja', label: 'LOJA' },
        { key: 'fornecedor', label: 'FORNECEDOR' },
        { key: 'forma_pagamento', label: 'FORMA DE PAGAMENTO' },
        { key: 'mes_faturamento', label: 'MÊS DE FATURAMENTO' },
        { key: 'acao', label: 'AÇÃO' },
        { key: 'tipo_pedido', label: 'TIPO DE PEDIDO (PE/PGM)' },
        { key: 'nome_item', label: 'NOME DO ITEM' },
        { key: 'ref_fornecedor', label: 'REF FORNECEDOR' },
        { key: 'ref_linx', label: 'REF LINX' },
        { key: 'cor', label: 'COR' },
        { key: 'tamanho', label: 'TAMANHO' },
        { key: 'preco_unitario', label: 'PREÇO UNITÁRIO' },
        { key: 'total_itens', label: 'TOTAL DE ITENS' },
        { key: 'grades', label: 'GRADES' },
        { key: 'preco_total', label: 'PREÇO TOTAL' },
        { key: 'nf_numero', label: 'Nº NF' },
        { key: 'status_pedido', label: 'STATUS DO PEDIDO' }
      ];

      exportToCSV(linhas, columns, `extrato-itens-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success(`Extrato gerado com ${linhas.length} linha(s)`);
    } catch (error) {
      console.error('Erro ao gerar extrato:', error);
      toast.error('Erro ao gerar o extrato detalhado');
    }
  };

  const handleExportPDF = () => {
    const exportData = filteredPedidos.map(pedido => {
      const statusInfo = getStatusInfo(pedido.status);
      const paymentInfo = getPaymentStatusInfo(pedido.status_pagamento);
      const itens = Array.isArray(pedido.itens) ? pedido.itens : JSON.parse(pedido.itens || '[]');
      const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
      const lojaName = pedido.loja_id && lojasMap[pedido.loja_id] ? lojasMap[pedido.loja_id] : '-';

      return {
        numero_pedido: `#${pedido.id.slice(-8).toUpperCase()}`,
        fornecedor: getFornecedorNome(pedido.fornecedor_id),
        loja: lojaName,
        data_pedido: formatDate(pedido.created_date),
        data_faturamento: pedido.nf_data_upload ? formatDate(pedido.nf_data_upload) : '-',
        nf_numero: pedido.nf_numero || '-',
        status: statusInfo.label,
        status_pagamento: paymentInfo.label,
        quantidade_itens: totalItens,
        valor_total: formatCurrency(pedido.valor_final || pedido.valor_total)
      };
    });

    const columns = [
      { key: 'numero_pedido', label: 'Pedido' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'loja', label: 'Loja' },
      { key: 'data_pedido', label: 'Data Pedido' },
      { key: 'data_faturamento', label: 'Faturamento' },
      { key: 'nf_numero', label: 'NF' },
      { key: 'status', label: 'Status' },
      { key: 'status_pagamento', label: 'Pagamento' },
      { key: 'quantidade_itens', label: 'Qtd.' },
      { key: 'valor_total', label: 'Valor Total' }
    ];

    exportToPDF(
      exportData,
      columns,
      `Meus Pedidos - ${user?.empresa || user?.full_name || 'Cliente'}`,
      `meus_pedidos_${new Date().toISOString().split('T')[0]}.pdf`,
      { orientation: 'landscape' }
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

    // Filtro por MÊS de faturamento (NF, senão mês da cápsula/entrega).
    let matchesMesFat = true;
    if (filtroMesFaturamento !== 'todos') {
      matchesMesFat = getMesesFaturamentoPedido(pedido, produtoEntregaMap || {}).includes(filtroMesFaturamento);
    }

    return matchesSearch && matchesStatus && matchesEmissao && matchesFaturamento && matchesVencimento && matchesMesFat;
  });

  // Meses de faturamento disponíveis (de TODOS os pedidos), mais recente primeiro.
  const mesesFaturamentoDisponiveis = [...new Set(
    pedidos.flatMap(p => getMesesFaturamentoPedido(p, produtoEntregaMap || {}))
  )].sort().reverse();

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

            <div className="flex gap-2">
              <Button
                onClick={handleExportExtratoItens}
                variant="outline"
                className="rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                title="CSV com uma linha por item, incluindo mês de faturamento e ação"
              >
                <FileText className="w-4 h-4 mr-2" />
                Extrato Detalhado
              </Button>
              <Button
                onClick={handleExportPDF}
                variant="outline"
                className="rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                className="rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            </div>
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

          {/* Filtro por MÊS de faturamento (NF, senão mês da cápsula/entrega) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Mês de faturamento
            </Label>
            <Select value={filtroMesFaturamento} onValueChange={setFiltroMesFaturamento}>
              <SelectTrigger className="w-56 rounded-xl shadow-neumorphic-inset">
                <SelectValue placeholder="Todos os meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {mesesFaturamentoDisponiveis.map(m => (
                  <SelectItem key={m} value={m} className="capitalize">{formatMesAno(`${m}-01`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtroMesFaturamento !== 'todos' && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFiltroMesFaturamento('todos')}>
                <X className="w-3 h-3 mr-1" /> limpar
              </Button>
            )}
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

                      {/* Cliente pode editar/cancelar enquanto fornecedor nao recebeu */}
                      {pedido.status === 'novo_pedido' && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setShowItensEditModal(true);
                            }}
                            className="w-full rounded-xl border-blue-300 text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Pedido
                          </Button>
                          <Button
                            variant="outline"
                            onClick={async () => {
                              if (!confirm(`Tem certeza que deseja cancelar o pedido #${pedido.id.slice(-8).toUpperCase()}?\n\nEsta ação não pode ser desfeita.`)) return;
                              try {
                                await Pedido.update(pedido.id, { status: 'cancelado' });
                                toast.success('Pedido cancelado com sucesso.');
                                loadData();
                              } catch (err) {
                                toast.error('Erro ao cancelar pedido. Tente novamente.');
                              }
                            }}
                            className="w-full rounded-xl border-red-300 text-red-700 hover:bg-red-50"
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            Cancelar Pedido
                          </Button>
                        </>
                      )}
                      
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
          produtoEntregaMap={produtoEntregaMap}
          userMap={user ? new Map([[user.id, user.empresa || user.full_name || user.email]]) : undefined}
          fornecedorMap={new Map(fornecedores.map(f => [f.id, f.razao_social || f.nome_fantasia || f.nome_marca]))}
        />
      )}

      {/* Modal de Editar Itens (cliente, enquanto status = novo_pedido) */}
      {showItensEditModal && selectedPedido && (
        <PedidoItensEditModal
          pedido={selectedPedido}
          currentUser={user}
          fornecedor={fornecedores.find(f => f.id === selectedPedido.fornecedor_id)}
          onClose={() => {
            setShowItensEditModal(false);
            setSelectedPedido(null);
          }}
          onUpdate={() => {
            loadData();
            setShowItensEditModal(false);
            setSelectedPedido(null);
          }}
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

      {/* Modal de Upload de Comprovante */}
      {showComprovanteModal && (
        <Dialog open={showComprovanteModal} onOpenChange={(open) => {
          if (!open) {
            setShowComprovanteModal(false);
            setComprovanteFile(null);
            setDataPagamentoComprovante('');
            setSelectedTitulo(null);
          }
        }}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Enviar Comprovante de Pagamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedTitulo && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-sm text-gray-600 mb-1">
                    Pedido #{selectedTitulo.pedido_id ? selectedTitulo.pedido_id.slice(-8).toUpperCase() : 'N/A'}
                    {selectedTitulo.parcela_numero && ` - Parcela ${selectedTitulo.parcela_numero}/${selectedTitulo.total_parcelas || '?'}`}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(selectedTitulo.valor)}</p>
                  <p className="text-sm text-gray-500">
                    Vencimento: {new Date(selectedTitulo.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1">Data do Pagamento *</label>
                <Input
                  type="date"
                  value={dataPagamentoComprovante}
                  onChange={(e) => setDataPagamentoComprovante(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">Informe a data em que o pagamento foi realizado</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Comprovante *</label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setComprovanteFile(e.target.files[0])}
                />
                <p className="text-xs text-gray-500 mt-1">Formatos aceitos: PDF, JPG, JPEG, PNG</p>
              </div>

              <Alert>
                <AlertDescription>
                  Após enviar o comprovante, ele será analisado pelo departamento financeiro.
                  Você receberá uma notificação quando for aprovado ou recusado.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowComprovanteModal(false);
                    setComprovanteFile(null);
                    setDataPagamentoComprovante('');
                    setSelectedTitulo(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEnviarComprovantePedido}
                  disabled={!comprovanteFile || !dataPagamentoComprovante || uploadingComprovante}
                  className="bg-blue-600"
                >
                  {uploadingComprovante ? 'Enviando...' : 'Enviar Comprovante'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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

            {/* Campo de observação — só aparece para recebimento de produto */}
            {tipoConfirmacao === 'recebimento' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Observação (opcional)
                </label>
                <textarea
                  value={observacaoRecebimento}
                  onChange={(e) => setObservacaoRecebimento(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Produto recebido com defeito na embalagem, peça com risco no tecido..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use este campo para relatar problemas como defeitos, peças faltando ou avarias.
                </p>
              </div>
            )}

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
                  setObservacaoRecebimento('');
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
