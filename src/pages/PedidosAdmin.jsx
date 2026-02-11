
import { useState, useEffect, useMemo } from 'react';
import { Pedido } from '@/api/entities';
import { User } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Package, Clock, CheckCircle, Truck, X, Eye, Edit, FileText, DollarSign, Download, 
  CreditCard, Calendar, MapPin, Receipt, Search, Filter, List, Columns
} from 'lucide-react';
import PedidoCard from '../components/pedidos/PedidoCard';
import PedidoDetailsModal from '../components/pedidos/PedidoDetailsModal';
import PedidoEditModal from '../components/pedidos/PedidoEditModal';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime, formatDate } from '@/utils/exportUtils';
import MultiSelectFilter from '@/components/MultiSelectFilter';
import { Loja } from '@/api/entities';
import { Store } from 'lucide-react';

export default function PedidosAdmin() {
  const [pedidos, setPedidos] = useState([]);
  const [users, setUsers] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [lojasMap, setLojasMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' ou 'list'
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingPedidoId, setUpdatingPedidoId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtrosStatus, setFiltrosStatus] = useState([]); // Array para múltipla seleção de status do pedido
  const [filtrosPagamento, setFiltrosPagamento] = useState([]); // Array para múltipla seleção de status de pagamento
  const [filtrosFornecedor, setFiltrosFornecedor] = useState([]); // Array para múltipla seleção de fornecedor
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [me, pedidosList, usersList, fornecedoresList, lojasList] = await Promise.all([
        User.me(),
        Pedido.list({ sort: '-created_date' }),
        User.list(),
        Fornecedor.list(),
        Loja.list()
      ]);
      setCurrentUser(me);
      setPedidos(pedidosList || []);
      setUsers(usersList || []);
      setFornecedores(fornecedoresList || []);

      // Build lojas map
      const map = {};
      (lojasList || []).forEach(l => { map[l.id] = l.nome_fantasia || l.nome; });
      setLojasMap(map);
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

      // Preparar dados para exportação
      const exportData = filteredPedidos.map(pedido => {
        const statusLabels = {
          novo_pedido: 'Novo Pedido',
          em_producao: 'Em Produção',
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

        return {
          id: `#${pedido.id.slice(-8).toUpperCase()}`,
          data: formatDateTime(pedido.created_date),
          cliente: userMap.get(pedido.comprador_user_id) || 'N/A',
          fornecedor: fornecedorMap.get(pedido.fornecedor_id) || 'N/A',
          status: statusLabels[pedido.status] || pedido.status,
          status_pagamento: paymentLabels[pedido.status_pagamento] || pedido.status_pagamento,
          valor_total: pedido.valor_total || 0,
          valor_final: pedido.valor_final || pedido.valor_total || 0,
          metodo_pagamento: pedido.metodo_pagamento || 'Não informado'
        };
      });

      // Definir colunas
      const columns = [
        { key: 'id', label: 'Pedido' },
        { key: 'data', label: 'Data' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'status', label: 'Status' },
        { key: 'status_pagamento', label: 'Pagamento' },
        { key: 'valor_total', label: 'Valor Total' },
        { key: 'valor_final', label: 'Valor Final' },
        { key: 'metodo_pagamento', label: 'Método Pagamento' }
      ];

      if (format === 'pdf') {
        exportToPDF(
          exportData,
          columns,
          'Relatório de Pedidos - Polo Wear',
          `pedidos_${new Date().toISOString().split('T')[0]}.pdf`
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

  const handleViewDetails = (pedido) => {
    setSelectedPedido(pedido);
    setShowDetailsModal(true);
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      novo_pedido: { label: 'Novo Pedido', color: 'bg-blue-100 text-blue-800', icon: Clock },
      em_producao: { label: 'Em Produção', color: 'bg-yellow-100 text-yellow-800', icon: Package },
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

  const limparFiltros = () => {
    setFiltrosStatus([]);
    setFiltrosPagamento([]);
    setFiltrosFornecedor([]);
    setFiltroPeriodo('all');
    setSearchTerm('');
  };

  const temFiltrosAtivos = filtrosStatus.length > 0 || filtrosPagamento.length > 0 || filtrosFornecedor.length > 0 || filtroPeriodo !== 'all' || searchTerm;

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
  }, [pedidos, searchTerm, filtrosStatus, filtrosPagamento, filtrosFornecedor, filtroPeriodo, users, fornecedores]);

  // Calcular totais por status
  const calcularTotaisPorStatus = () => {
    const totais = {
      novo_pedido: { count: 0, valor: 0 },
      em_producao: { count: 0, valor: 0 },
      faturado: { count: 0, valor: 0 },
      em_transporte: { count: 0, valor: 0 },
      pendente_pagamento: { count: 0, valor: 0 },
      finalizado: { count: 0, valor: 0 },
      cancelado: { count: 0, valor: 0 }
    };

    filteredPedidos.forEach(pedido => {
      if (totais.hasOwnProperty(pedido.status)) {
        totais[pedido.status].count++;
        totais[pedido.status].valor += pedido.valor_total || 0;
      }
    });

    return totais;
  };

  const totaisPorStatus = calcularTotaisPorStatus();
  const valorTotalGeral = Object.values(totaisPorStatus).reduce((sum, t) => sum + t.valor, 0);

  const statusColumns = [
    { key: 'novo_pedido', title: 'Novos Pedidos', color: 'border-blue-500' },
    { key: 'em_producao', title: 'Em Produção', color: 'border-yellow-500' },
    { key: 'faturado', title: 'Faturados', color: 'border-purple-500' },
    { key: 'em_transporte', title: 'Em Transporte', color: 'border-orange-500' },
    { key: 'pendente_pagamento', title: 'Aguardando Pagamento', color: 'border-amber-500' },
    { key: 'finalizado', title: 'Finalizados', color: 'border-green-500' },
    { key: 'cancelado', title: 'Cancelados', color: 'border-red-500' }
  ];

  const userMap = new Map(users.map(u => [u.id, u.empresa || u.razao_social || u.nome_marca || u.full_name]));
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
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards de Resumo por Status */}
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
                <p className="text-lg font-bold text-gray-900">
                  R$ {total.valor.toFixed(0)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total Geral */}
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
              Total de {filteredPedidos.length} pedido(s) • 
              Finalizados: {totaisPorStatus.finalizado.count} ({formatCurrency(totaisPorStatus.finalizado.valor)})
            </p>
          </div>
        </CardContent>
      </Card>

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
          </div>

          {/* Indicador de filtros ativos */}
          {temFiltrosAtivos && (
            <div className="text-sm text-gray-500 pt-2 border-t">
              Filtros ativos: {filtrosStatus.length + filtrosPagamento.length + filtrosFornecedor.length + (filtroPeriodo !== 'all' ? 1 : 0)} |
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
                            <div>{userMap.get(pedido.comprador_user_id) || 'N/A'}</div>
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
                            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          </td>
                          <td className="p-4">
                            <Badge className={paymentStatusInfo.color}>{paymentStatusInfo.label}</Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(pedido)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleEditPedido(pedido)}>
                                <Edit className="w-4 h-4" />
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
    </div>
  );
}
