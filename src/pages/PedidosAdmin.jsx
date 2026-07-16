
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pedido } from '@/api/entities';
import { User } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Produto } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Package, Clock, CheckCircle, Truck, X, Eye, Edit, FileText, DollarSign, Download,
  CreditCard, Calendar, MapPin, Receipt, Search, Filter, List, Columns, BarChart3
} from 'lucide-react';
import PedidoCard from '../components/pedidos/PedidoCard';
import PedidoDetailsModal from '../components/pedidos/PedidoDetailsModal';
import PedidoEditModal from '../components/pedidos/PedidoEditModal';
import PedidoItensEditModal from '../components/pedidos/PedidoItensEditModal';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime, formatDate, getMesFaturamentoItem, getMesEntregaItem } from '@/utils/exportUtils';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import { Loja } from '@/api/entities';
import { Store } from 'lucide-react';
import { can, PERM } from '@/utils/permissoes';

export default function PedidosAdmin() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [users, setUsers] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [lojasMap, setLojasMap] = useState({});
  const [lojasDetMap, setLojasDetMap] = useState({});
  // produto_id -> data_prevista_entrega (define o mes de faturamento de cada item)
  const [produtoEntregaMap, setProdutoEntregaMap] = useState({});
  // produto_id -> acao (Caps 1, Black Friday...) para a coluna AÇÃO do extrato
  const [produtoAcaoMap, setProdutoAcaoMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' ou 'list'
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItensEditModal, setShowItensEditModal] = useState(false);
  const [updatingPedidoId, setUpdatingPedidoId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosStatus, setFiltrosStatus] = useState([]); // Array para múltipla seleção de status do pedido
  const [filtrosPagamento, setFiltrosPagamento] = useState([]); // Array para múltipla seleção de status de pagamento
  const [filtrosFornecedor, setFiltrosFornecedor] = useState([]); // Array para múltipla seleção de fornecedor
  const [filtrosCliente, setFiltrosCliente] = useState([]); // Array para múltipla seleção de cliente
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await User.me();

      // O acesso a esta pagina agora e decidido por ProtectedRoute
      // (PERM.VER_TODOS_PEDIDOS): admin e vendedor. Fornecedor foi movido para
      // PedidosFornecedor — aqui ele via o total geral de TODOS os pedidos do
      // sistema, nao so dos dele.

      const [pedidosList, usersList, fornecedoresList, lojasList, produtosList] = await Promise.all([
        Pedido.list({ sort: '-created_date' }),
        User.list(),
        Fornecedor.list(),
        Loja.list(),
        Produto.list()
      ]);
      setCurrentUser(me);
      setPedidos(pedidosList || []);
      setUsers(usersList || []);
      setFornecedores(fornecedoresList || []);

      const entregaMap = {};
      const acaoMap = {};
      (produtosList || []).forEach(p => {
        if (p.data_prevista_entrega) entregaMap[p.id] = p.data_prevista_entrega;
        if (p.acao) acaoMap[p.id] = p.acao;
      });
      setProdutoEntregaMap(entregaMap);
      setProdutoAcaoMap(acaoMap);

      // Build lojas map
      const map = {};
      const detMap = {};
      (lojasList || []).forEach(l => {
        map[l.id] = l.nome_fantasia || l.nome;
        detMap[l.id] = {
          nome: l.nome_fantasia || l.nome || '',     // nome fantasia (rotulo "Loja")
          razao: l.nome || l.nome_fantasia || '',    // razao social legal (NF)
          cnpj: l.cnpj || ''
        };
      });
      setLojasMap(map);
      setLojasDetMap(detMap);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format) => {
    try {
      if (!filteredPedidos || filteredPedidos.length === 0) {
        toast.info('Não há pedidos para exportar');
        return;
      }

      // Mapa user_id → {cnpj, razao} (fallback quando pedido nao tem loja_id).
      // Quando ha loja_id, preferir razao+cnpj da LOJA (eh o que vai pra NF).
      const userDetalhesMap = new Map(users.map(u => [u.id, {
        cnpj: u.cnpj || '',
        razao: u.empresa || u.razao_social || u.full_name || ''
      }]));

      // Preparar dados para exportação
      const exportData = filteredPedidos.map(pedido => {
        const statusLabels = {
          novo_pedido: 'Novo Pedido',
          em_producao: 'Em Produção',
          parcialmente_faturado: 'Parcialmente Faturado',
          faturado: 'Faturado',
          em_transporte: 'Em Transporte',
          pendente_pagamento: 'Aguardando Pagamento',
          finalizado: 'Finalizado',
          cancelado: 'Cancelado'
        };
        const paymentLabels = {
          pendente: 'Pendente',
          pago: 'Pago',
          atrasado: 'Atrasado',
          cancelado: 'Cancelado',
          em_analise: 'Em Análise'
        };

        // Soma quantidade total de pecas (considerando grades)
        let itens = pedido.itens || [];
        if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch { itens = []; } }
        const qtdPecas = (itens || []).reduce((sum, it) => {
          const isGrade = it.tipo_venda === 'grade' && (it.total_pecas_grade || 0) > 0;
          return sum + (it.quantidade || 0) * (isGrade ? (it.total_pecas_grade || 1) : 1);
        }, 0);

        const detUser = userDetalhesMap.get(pedido.comprador_user_id) || { cnpj: '', razao: 'N/A' };
        // Loja: razao social e CNPJ da LOJA (eh o que vai para a NF).
        // Fallback para os dados do user quando o pedido nao tem loja_id.
        const detLoja = pedido.loja_id ? lojasDetMap[pedido.loja_id] : null;

        return {
          id: `#${pedido.id.slice(-8).toUpperCase()}`,
          data: formatDateTime(pedido.created_date),
          cnpj: (detLoja && detLoja.cnpj) || detUser.cnpj || '-',
          razao_social: (detLoja && detLoja.razao) || detUser.razao || 'N/A',
          loja: (detLoja && detLoja.nome) || '-',
          fornecedor: fornecedorMap.get(pedido.fornecedor_id) || 'N/A',
          status: statusLabels[pedido.status] || pedido.status,
          status_pagamento: paymentLabels[pedido.status_pagamento] || pedido.status_pagamento,
          qtd_pecas: qtdPecas,
          valor_total: pedido.valor_total || 0,
          valor_final: pedido.valor_final || pedido.valor_total || 0,
          metodo_pagamento: pedido.metodo_pagamento || 'Não informado'
        };
      });

      // Colunas: CNPJ (da loja quando houver) + Razao + Loja para distinguir
      // matriz/filial; Qtd Pecas para visao macro.
      const columns = [
        { key: 'id', label: 'Pedido' },
        { key: 'data', label: 'Data' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'razao_social', label: 'Razão Social' },
        { key: 'loja', label: 'Loja' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'status', label: 'Status' },
        { key: 'status_pagamento', label: 'Pagamento' },
        { key: 'qtd_pecas', label: 'Qtd. Peças' },
        { key: 'valor_total', label: 'Valor Total' },
        { key: 'valor_final', label: 'Valor Final' },
        { key: 'metodo_pagamento', label: 'Método Pagamento' }
      ];

      if (format === 'pdf') {
        exportToPDF(
          exportData,
          columns,
          'Relatório de Pedidos - Polo Wear',
          `pedidos_${new Date().toISOString().split('T')[0]}.pdf`,
          { orientation: 'landscape' }
        );
      } else if (format === 'csv') {
        exportToCSV(
          exportData,
          columns,
          `pedidos_${new Date().toISOString().split('T')[0]}.csv`
        );
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados.');
    }
  };

  // Extrato detalhado por item (linha por item de pedido).
  // Modelo: NUMERO PEDIDO | CNPJ | RAZAO | LOJA | FORNECEDOR | FORMA DE PAGAMENTO |
  // MES FATURAMENTO | TIPO PEDIDO (PE/PGM) | NOME ITEM | REF FORNECEDOR | REF LINX |
  // COR | PRECO UNITARIO | TOTAL DE ITENS | PRECO TOTAL | STATUS PEDIDO
  const handleExportExtratoItens = () => {
    try {
      if (!filteredPedidos || filteredPedidos.length === 0) {
        toast.info('Não há pedidos para exportar');
        return;
      }

      const statusLabels = {
        novo_pedido: 'Novo Pedido',
        em_producao: 'Em Produção',
        parcialmente_faturado: 'Parcialmente Faturado',
        faturado: 'Faturado',
        em_transporte: 'Em Transporte',
        pendente_pagamento: 'Aguardando Pagamento',
        finalizado: 'Finalizado',
        cancelado: 'Cancelado'
      };
      const pgLabels = {
        pix: 'PIX',
        cartao_credito: 'Cartão de Crédito',
        boleto_faturado: 'Boleto Faturado',
        transferencia: 'Transferência Bancária'
      };
      const userDet = new Map(users.map(u => [u.id, {
        cnpj: u.cnpj || '',
        razao: u.empresa || u.razao_social || u.full_name || ''
      }]));

      const linhas = [];
      for (const pedido of filteredPedidos) {
        let itens = pedido.itens || [];
        if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch { itens = []; } }
        if (!Array.isArray(itens) || itens.length === 0) continue;

        const numero = `#${pedido.id.slice(-8).toUpperCase()}`;
        const det = userDet.get(pedido.comprador_user_id) || { cnpj: '', razao: 'N/A' };
        // Prefere razao+cnpj da loja (eh o que vai pra NF). Fallback no user.
        const detLoja = pedido.loja_id ? lojasDetMap[pedido.loja_id] : null;
        const cnpjLinha = (detLoja && detLoja.cnpj) || det.cnpj || '-';
        const razaoLinha = (detLoja && detLoja.razao) || det.razao || '';
        const nomeLoja = (detLoja && detLoja.nome) || '';
        const formaPg = pgLabels[pedido.metodo_pagamento] || pedido.metodo_pagamento || '';
        const prazos = pedido.boleto_prazos_dias;
        const formaPgComPrazo = (pedido.metodo_pagamento === 'boleto_faturado' && Array.isArray(prazos) && prazos.length)
          ? `${formaPg} (${prazos.join('/')} dias)`
          : formaPg;
        const statusPedido = statusLabels[pedido.status] || pedido.status || '';
        const nomeFornecedor = fornecedorMap.get(pedido.fornecedor_id) || 'N/A';
        // Data e hora do pedido em pt-BR (fuso SP)
        const dataPedido = pedido.created_date
          ? new Date(pedido.created_date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          : '';

        for (const it of itens) {
          const isGrade = it.tipo_venda === 'grade' && (it.total_pecas_grade || 0) > 0;
          const totalItens = (it.quantidade || 0) * (isGrade ? (it.total_pecas_grade || 1) : 1);
          const precoBase = Number(it.preco) || 0;
          const precoTotal = Number(it.total) || precoBase * (it.quantidade || 0);
          // PRECO UNITARIO sempre por PECA (consistente com TOTAL DE ITENS).
          // Para grade, divide o preco da grade pelo numero de pecas.
          const precoUnit = isGrade
            ? precoBase / (it.total_pecas_grade || 1)
            : precoBase;
          linhas.push({
            numero_pedido: numero,
            data_pedido: dataPedido,
            cnpj: cnpjLinha,
            razao: razaoLinha,
            loja: nomeLoja,
            fornecedor: nomeFornecedor,
            forma_pagamento: formaPgComPrazo,
            mes_faturamento: getMesFaturamentoItem(pedido, it, produtoEntregaMap),
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
            status_pedido: statusPedido
          });
        }
      }

      if (linhas.length === 0) {
        toast.info('Os pedidos filtrados não têm itens para extrair');
        return;
      }

      const columns = [
        { key: 'numero_pedido', label: 'NÚMERO DO PEDIDO' },
        { key: 'data_pedido', label: 'DATA DO PEDIDO' },
        { key: 'cnpj', label: 'CNPJ' },
        { key: 'razao', label: 'RAZÃO' },
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
        { key: 'status_pedido', label: 'STATUS DO PEDIDO' }
      ];

      exportToCSV(linhas, columns, `extrato-itens-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success(`Extrato gerado com ${linhas.length} linha(s)`);
    } catch (error) {
      console.error('Erro ao gerar extrato:', error);
      toast.error('Erro ao gerar extrato de itens.');
    }
  };

  // Relatório de Produção (admin)
  const handleExportRelatorioProducao = () => {
    const statusProducao = ['aprovado', 'em_producao', 'parcialmente_faturado'];
    const pedidosParaRelatorio = pedidos.filter(p => statusProducao.includes(p.status));

    if (pedidosParaRelatorio.length === 0) {
      toast.info('Nenhum pedido em produção para gerar relatório');
      return;
    }

    const agregado = {};
    pedidosParaRelatorio.forEach(pedido => {
      let itens = pedido.itens || [];
      if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch (e) { itens = []; } }

      itens.forEach(item => {
        const cor = item.cor_selecionada?.cor_nome || 'Sem cor';
        const mesEntrega = getMesEntregaItem(pedido, item, produtoEntregaMap);
        const key = `${item.produto_id || item.nome}_${cor}_${mesEntrega}`;
        if (!agregado[key]) {
          // Preco unitario sempre por PECA. Para grade, divide o preco
          // da grade inteira pelo numero de pecas da grade.
          const isGradePreco = item.tipo_venda === 'grade' && (item.total_pecas_grade || 0) > 0;
          const precoPorPeca = isGradePreco
            ? (item.preco || 0) / (item.total_pecas_grade || 1)
            : (item.preco || 0);
          agregado[key] = {
            nome: item.nome || '',
            referencia_fornecedor: item.referencia_fornecedor || item.referencia || '',
            referencia_linx: item.referencia_linx || item.referencia_polo || '',
            cor,
            preco_unitario: precoPorPeca,
            mes_entrega: mesEntrega,
            qtd_total_pecas: 0,
            qtd_grades: 0
          };
        }
        const qtdPendente = Math.max(0, (item.quantidade || 0) - (item.qtd_faturada || 0) - (item.qtd_quebra || 0));
        const isGrade = item.tipo_venda === 'grade' && (item.total_pecas_grade || 0) > 0;
        if (isGrade) {
          agregado[key].qtd_grades += qtdPendente;
          agregado[key].qtd_total_pecas += qtdPendente * (item.total_pecas_grade || 1);
        } else {
          agregado[key].qtd_total_pecas += qtdPendente;
        }
      });
    });

    const data = Object.values(agregado).filter(r => r.qtd_total_pecas > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.cor.localeCompare(b.cor));

    if (data.length === 0) { toast.info('Nenhum item pendente de produção'); return; }

    const columns = [
      { key: 'nome', label: 'Produto' },
      { key: 'referencia_fornecedor', label: 'Ref. Fornecedor' },
      { key: 'referencia_linx', label: 'Ref. Linx' },
      { key: 'cor', label: 'Cor / Variante' },
      { key: 'preco_unitario_fmt', label: 'Preço Unit.' },
      { key: 'mes_entrega', label: 'Mês Entrega' },
      { key: 'qtd_total_pecas', label: 'Qtd. Total Peças' },
      { key: 'qtd_grades', label: 'Qtd. Grades' }
    ];

    exportToCSV(data.map(r => ({ ...r, preco_unitario_fmt: formatCurrency(r.preco_unitario) })), columns, `relatorio-producao-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`Relatório gerado com ${data.length} produto(s)`);
  };

  const handleStatusChange = async (pedidoId, newStatus) => {
    setUpdatingPedidoId(pedidoId);
    try {
      await Pedido.update(pedidoId, { status: newStatus });
      await loadData();
    } catch (_error) {
      toast.error('Falha ao atualizar status.');
    } finally {
      setUpdatingPedidoId(null);
    }
  };

  const handlePaymentStatusChange = async (pedidoId, newStatus) => {
    setUpdatingPedidoId(pedidoId);
    try {
      const updateData = { 
        status_pagamento: newStatus,
        ...(newStatus === 'pago' && { data_pagamento: new Date().toISOString() })
      };
      await Pedido.update(pedidoId, updateData);
      await loadData();
    } catch (_error) {
      toast.error('Falha ao atualizar status do pagamento.');
    } finally {
      setUpdatingPedidoId(null);
    }
  };

  const handleEditPedido = (pedido) => {
    setSelectedPedido(pedido);
    setShowEditModal(true);
  };

  const handleEditItens = (pedido) => {
    setSelectedPedido(pedido);
    setShowItensEditModal(true);
  };

  const handleViewDetails = (pedido) => {
    setSelectedPedido(pedido);
    setShowDetailsModal(true);
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      novo_pedido: { label: 'Novo Pedido', color: 'bg-blue-100 text-blue-800', icon: Clock },
      em_producao: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: Package },
      parcialmente_faturado: { label: 'Parc. Faturado', color: 'bg-cyan-100 text-cyan-800', icon: Package },
      faturado: { label: 'Faturado', color: 'bg-purple-100 text-purple-800', icon: FileText },
      em_transporte: { label: 'Em Transporte', color: 'bg-orange-100 text-orange-800', icon: Truck },
      pendente_pagamento: { label: 'Aguardando Pagamento', color: 'bg-amber-100 text-amber-800', icon: Clock },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: X }
    };
    return statusMap[status] || statusMap.novo_pedido;
  };

  const getPaymentStatusInfo = (status) => {
    const statusMap = {
      pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      pago: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      atrasado: { label: 'Atrasado', color: 'bg-orange-100 text-orange-800', icon: Clock },
      cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: X }
    };
    return statusMap[status] || statusMap.pendente;
  };

  // Funções de toggle para filtros
  const toggleFiltroStatus = (status) => {
    setFiltrosStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleFiltroPagamento = (status) => {
    setFiltrosPagamento(prev =>
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

  const toggleFiltroCliente = (clienteId) => {
    setFiltrosCliente(prev =>
      prev.includes(clienteId)
        ? prev.filter(c => c !== clienteId)
        : [...prev, clienteId]
    );
  };

  const limparFiltros = () => {
    setFiltrosStatus([]);
    setFiltrosPagamento([]);
    setFiltrosFornecedor([]);
    setFiltrosCliente([]);
    setFiltroPeriodo('all');
    setSearchTerm('');
  };

  const temFiltrosAtivos = filtrosStatus.length > 0 || filtrosPagamento.length > 0 || filtrosFornecedor.length > 0 || filtrosCliente.length > 0 || filtroPeriodo !== 'all' || searchTerm;

  // Filtrar pedidos
  const filteredPedidos = useMemo(() => {
    let filtered = pedidos || [];

    if (searchTerm) {
      filtered = filtered.filter(pedido =>
        pedido.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        users.find(u => u.id === pedido.comprador_user_id)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornecedores.find(f => f.id === pedido.fornecedor_id)?.nome_marca?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status do pedido (múltipla seleção)
    if (filtrosStatus.length > 0) {
      filtered = filtered.filter(pedido => filtrosStatus.includes(pedido.status));
    }

    // Filtro por fornecedor (múltipla seleção)
    if (filtrosFornecedor.length > 0) {
      filtered = filtered.filter(pedido => filtrosFornecedor.includes(pedido.fornecedor_id));
    }

    // Filtro por cliente (múltipla seleção)
    if (filtrosCliente.length > 0) {
      filtered = filtered.filter(pedido => filtrosCliente.includes(pedido.comprador_user_id));
    }

    // Filtro por status de pagamento (múltipla seleção)
    if (filtrosPagamento.length > 0) {
      filtered = filtered.filter(pedido => filtrosPagamento.includes(pedido.status_pagamento));
    }

    // Filtro por período
    if (filtroPeriodo !== 'all') {
      const hoje = new Date();
      let dataLimite;

      switch (filtroPeriodo) {
        case '7_dias':
          dataLimite = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30_dias':
          dataLimite = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90_dias':
          dataLimite = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          dataLimite = null;
      }

      if (dataLimite) {
        filtered = filtered.filter(pedido => new Date(pedido.created_date) >= dataLimite);
      }
    }

    return filtered;
  }, [pedidos, searchTerm, filtrosStatus, filtrosPagamento, filtrosFornecedor, filtrosCliente, filtroPeriodo, users, fornecedores]);

  // Calcular totais por status
  const calcularTotaisPorStatus = () => {
    const totais = {
      novo_pedido: { count: 0, valor: 0, pecas: 0 },
      em_producao: { count: 0, valor: 0, pecas: 0 },
      faturado: { count: 0, valor: 0, pecas: 0 },
      em_transporte: { count: 0, valor: 0, pecas: 0 },
      pendente_pagamento: { count: 0, valor: 0, pecas: 0 },
      finalizado: { count: 0, valor: 0, pecas: 0 },
      cancelado: { count: 0, valor: 0, pecas: 0 }
    };

    filteredPedidos.forEach(pedido => {
      if (totais.hasOwnProperty(pedido.status)) {
        totais[pedido.status].count++;
        totais[pedido.status].valor += pedido.valor_total || 0;
        // Soma total de pecas dos itens (multiplica por total_pecas_grade quando for grade)
        let itens = pedido.itens || [];
        if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch { itens = []; } }
        const qtdPecas = (itens || []).reduce((sum, it) => {
          const isGrade = it.tipo_venda === 'grade' && (it.total_pecas_grade || 0) > 0;
          return sum + (it.quantidade || 0) * (isGrade ? (it.total_pecas_grade || 1) : 1);
        }, 0);
        totais[pedido.status].pecas += qtdPecas;
      }
    });

    return totais;
  };

  const totaisPorStatus = calcularTotaisPorStatus();
  const valorTotalGeral = Object.entries(totaisPorStatus)
    .filter(([status]) => status !== 'cancelado')
    .reduce((sum, [, t]) => sum + t.valor, 0);

  const statusColumns = [
    { key: 'novo_pedido', title: 'Novos Pedidos', color: 'border-blue-500' },
    { key: 'em_producao', title: 'Em Produção', color: 'border-yellow-500' },
    { key: 'parcialmente_faturado', title: 'Parc. Faturados', color: 'border-cyan-500' },
    { key: 'faturado', title: 'Faturados', color: 'border-purple-500' },
    { key: 'em_transporte', title: 'Em Transporte', color: 'border-orange-500' },
    { key: 'pendente_pagamento', title: 'Aguardando Pagamento', color: 'border-amber-500' },
    { key: 'finalizado', title: 'Finalizados', color: 'border-green-500' },
    { key: 'cancelado', title: 'Cancelados', color: 'border-red-500' }
  ];

  // Vendedor acompanha os pedidos, mas nao o dinheiro consolidado.
  const podeVerFaturamento = can(currentUser, PERM.VER_TOTAIS_FATURAMENTO);
  const podeExportar = can(currentUser, PERM.EXPORTAR_DADOS);

  const userMap = new Map(users.map(u => [u.id, u.empresa || u.razao_social || u.nome_marca || u.full_name]));
  const userTipoMap = new Map(users.map(u => [u.id, u.tipo_negocio]));
  const fornecedorMap = new Map(fornecedores.map(f => [f.id, f.razao_social || f.nome_fantasia || f.nome_marca]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Pedidos</h1>
          <p className="text-gray-600">Acompanhe e gerencie todos os pedidos do sistema</p>
        </div>
        
        {podeExportar && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportRelatorioProducao} variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <BarChart3 className="w-4 h-4 mr-2" />
              Relatório Produção
            </Button>
            <Button onClick={handleExportExtratoItens} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <FileText className="w-4 h-4 mr-2" />
              Extrato Detalhado
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')}>
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        )}
      </div>

      {/* Cards de Resumo por Status.
          O vendedor ve a CONTAGEM e as PECAS, mas nao os valores em R$. */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {statusColumns.map((column) => {
          const total = totaisPorStatus[column.key];
          if (!total) return null; // Fallback for safety, though should not be needed with updated statusColumns
          const statusInfo = getStatusInfo(column.key);
          const StatusIcon = statusInfo.icon;

          return (
            <Card key={column.key} className="bg-slate-100 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <StatusIcon className="w-5 h-5 text-gray-600" />
                  <Badge className={statusInfo.color}>{total.count}</Badge>
                </div>
                <p className="text-xs text-gray-600 mb-1">{statusInfo.label}</p>
                {podeVerFaturamento ? (
                  <p className="text-lg font-bold text-gray-900">
                    R$ {total.valor.toFixed(0)}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-gray-900">
                    {total.count} pedido{total.count === 1 ? '' : 's'}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {total.pecas.toLocaleString('pt-BR')} peça{total.pecas === 1 ? '' : 's'}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total Geral — faturamento consolidado. Escondido do vendedor. */}
      {podeVerFaturamento && (
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90 mb-1">Valor Total de Todos os Pedidos</p>
                <p className="text-4xl font-bold">{formatCurrency(valorTotalGeral)}</p>
              </div>
              <DollarSign className="w-16 h-16 opacity-50" />
            </div>
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-sm opacity-90">
                Total de {filteredPedidos.length} pedido(s) •{' '}
                {Object.values(totaisPorStatus).reduce((s, t) => s + (t.pecas || 0), 0).toLocaleString('pt-BR')} peça(s) •{' '}
                Finalizados: {totaisPorStatus.finalizado.count} ({formatCurrency(totaisPorStatus.finalizado.valor)})
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-4 space-y-4">
          {/* Search e ações */}
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por cliente, fornecedor ou ID do pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Período (mantém como select simples) */}
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7_dias">7 dias</SelectItem>
                <SelectItem value="30_dias">30 dias</SelectItem>
                <SelectItem value="90_dias">90 dias</SelectItem>
              </SelectContent>
            </Select>

            {temFiltrosAtivos && (
              <Button
                variant="outline"
                size="sm"
                onClick={limparFiltros}
                className="text-gray-600"
              >
                Limpar Filtros
              </Button>
            )}

            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                <Columns className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filtros Dropdown */}
          <div className="flex flex-wrap gap-2 items-center">
            <MultiSelectFilter
              label="Status do Pedido"
              options={[
                { value: 'novo_pedido', label: 'Novos' },
                { value: 'em_producao', label: 'Em Produção' },
                { value: 'faturado', label: 'Faturados' },
                { value: 'em_transporte', label: 'Em Transporte' },
                { value: 'pendente_pagamento', label: 'Aguardando Pagamento' },
                { value: 'finalizado', label: 'Finalizados' },
                { value: 'cancelado', label: 'Cancelados' }
              ]}
              selected={filtrosStatus}
              onToggle={toggleFiltroStatus}
              onClear={() => setFiltrosStatus([])}
            />
            <MultiSelectFilter
              label="Status Pagamento"
              options={[
                { value: 'pendente', label: 'Pendente' },
                { value: 'pago', label: 'Pago' },
                { value: 'em_analise', label: 'Em Análise' },
                { value: 'atrasado', label: 'Atrasado' }
              ]}
              selected={filtrosPagamento}
              onToggle={toggleFiltroPagamento}
              onClear={() => setFiltrosPagamento([])}
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
            {users.filter(u => u.tipo_negocio === 'multimarca' || u.tipo_negocio === 'franqueado').length > 0 && (
              <MultiSelectFilter
                label="Cliente"
                options={users
                  .filter(u => u.tipo_negocio === 'multimarca' || u.tipo_negocio === 'franqueado')
                  .map(u => ({
                    value: u.id,
                    label: u.empresa || u.razao_social || u.nome_marca || u.full_name
                  }))
                  .sort((a, b) => a.label.localeCompare(b.label))
                }
                selected={filtrosCliente}
                onToggle={toggleFiltroCliente}
                onClear={() => setFiltrosCliente([])}
              />
            )}
          </div>

          {/* Indicador de filtros ativos */}
          {temFiltrosAtivos && (
            <div className="text-sm text-gray-500 pt-2 border-t">
              Filtros ativos: {filtrosStatus.length + filtrosPagamento.length + filtrosFornecedor.length + filtrosCliente.length + (filtroPeriodo !== 'all' ? 1 : 0)} |
              Mostrando {filteredPedidos.length} de {pedidos.length} pedidos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' ? (
          // Kanban View
          <div className="h-full flex gap-4 overflow-x-auto pb-4">
            {statusColumns.map((column) => {
              const columnPedidos = filteredPedidos.filter(pedido => pedido.status === column.key);
              
              return (
                <div key={column.key} className={`flex-shrink-0 w-80 border-t-4 ${column.color}`}>
                  <Card className="h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-sm">
                        <span>{column.title}</span>
                        <Badge variant="outline">{columnPedidos.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                      {columnPedidos.map((pedido) => (
                        <PedidoCard
                          key={pedido.id}
                          pedido={pedido}
                          userMap={userMap}
                          fornecedorMap={fornecedorMap}
                          lojasMap={lojasMap}
                          onViewDetails={handleViewDetails}
                          onEdit={handleEditPedido}
                          onStatusChange={handleStatusChange}
                          onPaymentStatusChange={handlePaymentStatusChange}
                          getStatusInfo={getStatusInfo}
                          getPaymentStatusInfo={getPaymentStatusInfo}
                          updatingPedidoId={updatingPedidoId}
                        />
                      ))}
                      {columnPedidos.length === 0 && (
                        <p className="text-gray-500 text-center py-8">
                          Nenhum pedido neste status
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          // List View
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4">Pedido</th>
                      <th className="text-left p-4">Cliente</th>
                      <th className="text-left p-4">Fornecedor</th>
                      <th className="text-left p-4">Valor</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Pagamento</th>
                      <th className="text-left p-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPedidos.map((pedido) => {
                      const statusInfo = getStatusInfo(pedido.status);
                      const paymentStatusInfo = getPaymentStatusInfo(pedido.status_pagamento);
                      
                      return (
                        <tr key={pedido.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div>
                              <div className="font-medium">#{pedido.id.slice(-8).toUpperCase()}</div>
                              <div className="text-sm text-gray-500">{formatDate(pedido.created_date)}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span>{userMap.get(pedido.comprador_user_id) || 'N/A'}</span>
                              {userTipoMap.get(pedido.comprador_user_id) === 'multimarca' && (
                                <Badge className="bg-purple-100 text-purple-800 border border-purple-300 text-[10px] px-1.5 py-0">Multi</Badge>
                              )}
                              {userTipoMap.get(pedido.comprador_user_id) === 'franqueado' && (
                                <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-[10px] px-1.5 py-0">Franq</Badge>
                              )}
                            </div>
                            {pedido.loja_id && lojasMap[pedido.loja_id] && (
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-blue-600">
                                <Store className="w-3 h-3" />
                                {lojasMap[pedido.loja_id]}
                              </div>
                            )}
                          </td>
                          <td className="p-4">{fornecedorMap.get(pedido.fornecedor_id) || 'N/A'}</td>
                          <td className="p-4">
                            <span className="font-semibold text-green-600">
                              {formatCurrency(pedido.valor_total)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                              {pedido.impresso && (
                                <Badge className="bg-green-100 text-green-800 text-xs">Impresso</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={paymentStatusInfo.color}>{paymentStatusInfo.label}</Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(pedido)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEditPedido(pedido)} title="Editar status, transporte e documentos">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEditItens(pedido)} title="Revisar itens do pedido (quantidade)">
                                <Package className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {filteredPedidos.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum pedido encontrado</h3>
                  <p className="text-gray-600">Tente ajustar os filtros de busca.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showDetailsModal && selectedPedido && (
        <PedidoDetailsModal
          pedido={selectedPedido}
          currentUser={currentUser}
          userMap={userMap}
          fornecedorMap={fornecedorMap}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPedido(null);
          }}
          onUpdate={loadData}
        />
      )}

      {showEditModal && selectedPedido && (
        <PedidoEditModal
          pedido={selectedPedido}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPedido(null);
          }}
          onUpdate={loadData}
        />
      )}

      {showItensEditModal && selectedPedido && (
        <PedidoItensEditModal
          pedido={selectedPedido}
          currentUser={currentUser}
          fornecedor={fornecedores.find(f => f.id === selectedPedido.fornecedor_id)}
          onClose={() => {
            setShowItensEditModal(false);
            setSelectedPedido(null);
          }}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
