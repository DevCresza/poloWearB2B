
import React, { useState, useEffect } from 'react';
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
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime } from '@/utils/exportUtils';

export default function PedidosAdmin() {
  const [pedidos, setPedidos] = useState([]);
  const [users, setUsers] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' ou 'list'
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingPedidoId, setUpdatingPedidoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    fornecedor: 'all',
    status_pagamento: 'all',
    periodo: 'all'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pedidosList, usersList, fornecedoresList] = await Promise.all([
        Pedido.list('-created_date'), 
        User.list(), 
        Fornecedor.list()
      ]);
      setPedidos(pedidosList || []);
      setUsers(usersList || []);
      setFornecedores(fornecedoresList || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      // Preparar dados para exportação
      const exportData = getFilteredPedidos().map(pedido => ({
        id: pedido.id.substring(0, 8),
        data: formatDateTime(pedido.created_date),
        cliente: userMap.get(pedido.comprador_user_id) || 'Desconhecido',
        fornecedor: fornecedorMap.get(pedido.fornecedor_id) || 'Desconhecido',
        status: pedido.status,
        status_pagamento: pedido.status_pagamento,
        valor_total: pedido.valor_total,
        valor_final: pedido.valor_final,
        metodo_pagamento: pedido.metodo_pagamento || 'Não informado'
      }));

      // Definir colunas
      const columns = [
        { key: 'id', label: 'ID' },
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
        await exportToPDF(
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
      toast.error('Erro ao exportar dados.');
    }
  };

  const handleStatusChange = async (pedidoId, newStatus) => {
    setUpdatingPedidoId(pedidoId);
    try {
      await Pedido.update(pedidoId, { status: newStatus });
      await loadData();
    } catch (error) {
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
    } catch (error) {
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

  // Filtrar pedidos
  const filteredPedidos = React.useMemo(() => {
    let filtered = pedidos || [];
    
    if (searchTerm) {
      filtered = filtered.filter(pedido =>
        pedido.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        users.find(u => u.id === pedido.comprador_user_id)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fornecedores.find(f => f.id === pedido.fornecedor_id)?.nome_marca?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filters.fornecedor !== 'all') {
      filtered = filtered.filter(pedido => pedido.fornecedor_id === filters.fornecedor);
    }
    
    if (filters.status_pagamento !== 'all') {
      filtered = filtered.filter(pedido => pedido.status_pagamento === filters.status_pagamento);
    }
    
    if (filters.periodo !== 'all') {
      const hoje = new Date();
      let dataLimite;
      
      switch (filters.periodo) {
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
  }, [pedidos, searchTerm, filters, users, fornecedores]);

  // Calcular totais por status
  const calcularTotaisPorStatus = () => {
    const totais = {
      novo_pedido: { count: 0, valor: 0 },
      em_producao: { count: 0, valor: 0 },
      faturado: { count: 0, valor: 0 },
      em_transporte: { count: 0, valor: 0 },
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
    { key: 'finalizado', title: 'Finalizados', color: 'border-green-500' },
    { key: 'cancelado', title: 'Cancelados', color: 'border-red-500' }
  ];

  const userMap = new Map(users.map(u => [u.id, u.empresa || u.razao_social || u.nome_marca || u.full_name]));
  const fornecedorMap = new Map(fornecedores.map(f => [f.id, f.nome_marca]));

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
              <p className="text-4xl font-bold">R$ {valorTotalGeral.toFixed(2)}</p>
            </div>
            <DollarSign className="w-16 h-16 opacity-50" />
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm opacity-90">
              Total de {filteredPedidos.length} pedido(s) • 
              Finalizados: {totaisPorStatus.finalizado.count} (R$ {totaisPorStatus.finalizado.valor.toFixed(2)})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-4">
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
            
            {/* Filters */}
            <div className="flex gap-2">
              <Select value={filters.fornecedor} onValueChange={(value) => setFilters({...filters, fornecedor: value})}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Fornecedores</SelectItem>
                  {fornecedores.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome_marca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filters.status_pagamento} onValueChange={(value) => setFilters({...filters, status_pagamento: value})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filters.periodo} onValueChange={(value) => setFilters({...filters, periodo: value})}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="7_dias">7 dias</SelectItem>
                  <SelectItem value="30_dias">30 dias</SelectItem>
                  <SelectItem value="90_dias">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
                              <div className="font-medium">#{pedido.id.slice(-6).toUpperCase()}</div>
                              <div className="text-sm text-gray-500">{new Date(pedido.created_date).toLocaleDateString()}</div>
                            </div>
                          </td>
                          <td className="p-4">{userMap.get(pedido.comprador_user_id) || 'N/A'}</td>
                          <td className="p-4">{fornecedorMap.get(pedido.fornecedor_id) || 'N/A'}</td>
                          <td className="p-4">
                            <span className="font-semibold text-green-600">
                              R$ {pedido.valor_total?.toFixed(2)}
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
          userMap={userMap}
          fornecedorMap={fornecedorMap}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPedido(null);
          }}
          getStatusInfo={getStatusInfo}
          getPaymentStatusInfo={getPaymentStatusInfo}
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
