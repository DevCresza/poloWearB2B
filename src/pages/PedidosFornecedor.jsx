
import React, { useState, useEffect } from 'react';
import { Pedido } from '@/api/entities';
import { Produto } from '@/api/entities'; // Not used in this file, but kept from original imports
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Fornecedor } from '@/api/entities'; // Added import for Fornecedor
import { SendEmail, UploadFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Not used, but kept from original imports
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, Clock, CheckCircle, XCircle, Calendar, DollarSign,
  FileText, Upload, Download, Filter, Eye, Edit, Truck, AlertTriangle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PedidosFornecedor() {
  const [user, setUser] = useState(null);
  const [fornecedorAtual, setFornecedorAtual] = useState(null); // Fornecedor do usuário logado
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]); // Added new state for suppliers
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('todos');
  const [selectedPedido, setSelectedPedido] = useState(null);
  
  // Modais
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFaturarModal, setShowFaturarModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  
  // Forms
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [nfFile, setNfFile] = useState(null);
  const [boletoFile, setBoletoFile] = useState(null);
  const [nfNumero, setNfNumero] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [dataEnvio, setDataEnvio] = useState('');
  
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPedidos(); // Changed from loadData to loadPedidos
  }, []);

  const loadPedidos = async () => { // Renamed from loadData
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let pedidosList = [];
      let clientesList = [];

      if (currentUser.role === 'admin') {
        pedidosList = await Pedido.list('-created_date');
        clientesList = await User.list(); // Load all users for admin
      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Buscar fornecedor associado ao usuário (relação reversa via responsavel_user_id)
        const fornecedoresList = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
        const fornecedor = fornecedoresList[0];

        if (fornecedor) {
          setFornecedorAtual(fornecedor);
          pedidosList = await Pedido.filter({ fornecedor_id: fornecedor.id }, '-created_date');

          // Buscar todos os clientes para evitar problemas de "não encontrado"
          const todosClientes = await User.list();
          const clienteIds = [...new Set(pedidosList.map(p => p.comprador_user_id))];
          clientesList = todosClientes.filter(u => clienteIds.includes(u.id));
        }
      }

      setPedidos(pedidosList || []);
      setClientes(clientesList || []);

      const fornecedoresList = await Fornecedor.list(); // Fetch all suppliers
      setFornecedores(fornecedoresList);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getClienteNome = (userId) => {
    const cliente = clientes.find(c => c.id === userId);
    return cliente?.full_name || 'N/A';
  };

  const getClienteEmpresa = (userId) => {
    const cliente = clientes.find(c => c.id === userId);
    return cliente?.empresa || cliente?.razao_social || cliente?.nome_marca || cliente?.full_name || 'N/A';
  };

  const handleAprovar = async () => {
    if (!dataEntrega) {
      alert('Informe a data prevista de entrega');
      return;
    }

    try {
      await Pedido.update(selectedPedido.id, {
        status: 'aprovado',
        data_aprovacao: new Date().toISOString(),
        data_prevista_entrega: dataEntrega
      });

      // Notificar cliente
      await SendEmail({
        from_name: 'POLO B2B',
        to: clientes.find(c => c.id === selectedPedido.comprador_user_id)?.email,
        subject: `✅ Pedido Aprovado - #${selectedPedido.id.slice(-8).toUpperCase()}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">✅ Pedido Aprovado!</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>Seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi aprovado!</p>
              <p><strong>Data prevista de entrega:</strong> ${new Date(dataEntrega).toLocaleDateString('pt-BR')}</p>
              <p>Valor total: R$ ${selectedPedido.valor_total.toFixed(2)}</p>
              <p style="margin-top: 30px;">Acompanhe o status do seu pedido no sistema.</p>
            </div>
          </div>
        `
      });

      alert('Pedido aprovado com sucesso!');
      setShowApprovalModal(false);
      setDataEntrega('');
      loadPedidos(); // Changed from loadData
    } catch (error) {
      alert('Erro ao aprovar pedido');
    }
  };

  const handleRecusar = async () => {
    if (!motivoRecusa) {
      alert('Informe o motivo da recusa');
      return;
    }

    try {
      await Pedido.update(selectedPedido.id, {
        status: 'recusado',
        motivo_recusa: motivoRecusa
      });

      // Notificar cliente
      await SendEmail({
        from_name: 'POLO B2B',
        to: clientes.find(c => c.id === selectedPedido.comprador_user_id)?.email,
        subject: `❌ Pedido Recusado - #${selectedPedido.id.slice(-8).toUpperCase()}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">❌ Pedido Recusado</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>Infelizmente seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi recusado.</p>
              <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Motivo:</strong> ${motivoRecusa}
              </div>
              <p>Entre em contato conosco para mais informações.</p>
            </div>
          </div>
        `
      });

      alert('Pedido recusado');
      setShowRejectModal(false);
      setMotivoRecusa('');
      loadPedidos(); // Changed from loadData
    } catch (error) {
      alert('Erro ao recusar pedido');
    }
  };

  const handleFaturar = async () => {
    if (!nfFile || !nfNumero) {
      alert('Envie a nota fiscal e informe o número');
      return;
    }

    setUploading(true);
    try {
      // Upload NF
      const nfUpload = await UploadFile({ file: nfFile });
      
      let boletoUrl = null;
      if (boletoFile) {
        const boletoUpload = await UploadFile({ file: boletoFile });
        boletoUrl = boletoUpload.file_url;
      }

      // Atualizar pedido
      await Pedido.update(selectedPedido.id, {
        status: 'faturado',
        nf_url: nfUpload.file_url,
        nf_numero: nfNumero,
        nf_data_upload: new Date().toISOString(),
        boleto_url: boletoUrl,
        boleto_data_upload: boletoUrl ? new Date().toISOString() : null,
        metodo_pagamento_original: selectedPedido.metodo_pagamento,
        metodo_pagamento: metodoPagamento || selectedPedido.metodo_pagamento
      });

      // Criar títulos na carteira financeira
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30); // 30 dias para vencimento

      await Carteira.create({
        pedido_id: selectedPedido.id,
        cliente_user_id: selectedPedido.comprador_user_id,
        fornecedor_id: selectedPedido.fornecedor_id,
        tipo: 'a_receber',
        valor: selectedPedido.valor_total,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        status: 'pendente'
      });

      // Notificar cliente
      const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
      await SendEmail({
        from_name: 'POLO B2B',
        to: cliente?.email,
        subject: `📄 Pedido Faturado - NF #${nfNumero}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">📄 Pedido Faturado</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>Seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi faturado!</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Nota Fiscal:</strong> #${nfNumero}</p>
                <p><strong>Valor:</strong> R$ ${selectedPedido.valor_total.toFixed(2)}</p>
                <p><strong>Vencimento:</strong> ${dataVencimento.toLocaleDateString('pt-BR')}</p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${nfUpload.file_url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">
                  Baixar Nota Fiscal
                </a>
                ${boletoUrl ? `
                  <a href="${boletoUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-left: 10px;">
                    Baixar Boleto
                  </a>
                ` : ''}
              </div>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                Por favor, confirme o recebimento destes documentos no sistema.
              </p>
            </div>
          </div>
        `
      });

      alert('Pedido faturado com sucesso!');
      setShowFaturarModal(false);
      resetFaturarForm();
      loadPedidos(); // Changed from loadData
    } catch (error) {
      alert('Erro ao faturar pedido');
    } finally {
      setUploading(false);
    }
  };

  const handleEnviar = async () => {
    if (!transportadora || !dataEnvio) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      await Pedido.update(selectedPedido.id, {
        status: 'em_transporte',
        transportadora,
        codigo_rastreio: codigoRastreio,
        data_envio_real: dataEnvio
      });

      // Notificar cliente
      const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
      await SendEmail({
        from_name: 'POLO B2B',
        to: cliente?.email,
        subject: `🚚 Pedido Enviado - #${selectedPedido.id.slice(-8).toUpperCase()}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">🚚 Pedido em Transporte</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>Seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi enviado!</p>
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Transportadora:</strong> ${transportadora}</p>
                ${codigoRastreio ? `<p><strong>Código de Rastreio:</strong> ${codigoRastreio}</p>` : ''}
                <p><strong>Data de Envio:</strong> ${new Date(dataEnvio).toLocaleDateString('pt-BR')}</p>
              </div>
              <p>Acompanhe seu pedido no sistema!</p>
            </div>
          </div>
        `
      });

      alert('Informações de envio salvas!');
      setShowEnvioModal(false);
      resetEnvioForm();
      loadPedidos(); // Changed from loadData
    } catch (error) {
      alert('Erro ao atualizar informações de envio');
    }
  };

  const handleMudarMetodoPagamento = async (pedido, novoMetodo) => {
    if (!confirm(`Deseja alterar o método de pagamento para ${novoMetodo.toUpperCase()}?`)) {
      return;
    }

    try {
      await Pedido.update(pedido.id, {
        metodo_pagamento_original: pedido.metodo_pagamento,
        metodo_pagamento: novoMetodo
      });

      // Notificar cliente
      const cliente = clientes.find(c => c.id === pedido.comprador_user_id);
      await SendEmail({
        from_name: 'POLO B2B',
        to: cliente?.email,
        subject: `ℹ️ Alteração no Método de Pagamento`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #3b82f6; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">ℹ️ Alteração de Pagamento</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>O método de pagamento do seu pedido <strong>#${pedido.id.slice(-8).toUpperCase()}</strong> foi alterado.</p>
              <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Método anterior:</strong> ${pedido.metodo_pagamento.toUpperCase()}</p>
                <p><strong>Novo método:</strong> ${novoMetodo.toUpperCase()}</p>
              </div>
              <p>Esta alteração foi feita pelo fornecedor.</p>
            </div>
          </div>
        `
      });

      alert('Método de pagamento alterado!');
      loadPedidos(); // Changed from loadData
    } catch (error) {
      alert('Erro ao alterar método de pagamento');
    }
  };

  const handleExportPDF = async () => {
    try {
      if (!fornecedorAtual) {
        alert('Fornecedor não identificado');
        return;
      }

      const response = await base44.functions.invoke('exportPedidosFornecedor', {
        fornecedor_id: fornecedorAtual.id
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert('Erro ao exportar relatório');
    }
  };

  const resetFaturarForm = () => {
    setNfFile(null);
    setBoletoFile(null);
    setNfNumero('');
    setMetodoPagamento('');
  };

  const resetEnvioForm = () => {
    setTransportadora('');
    setCodigoRastreio('');
    setDataEnvio('');
  };

  // Helper objects for status badges, used in the CardHeader
  const statusColors = {
    novo_pedido: 'bg-blue-100 text-blue-800',
    em_analise: 'bg-yellow-100 text-yellow-800',
    aprovado: 'bg-green-100 text-green-800',
    recusado: 'bg-red-100 text-red-800',
    em_producao: 'bg-purple-100 text-purple-800',
    faturado: 'bg-indigo-100 text-indigo-800',
    em_transporte: 'bg-orange-100 text-orange-800',
    finalizado: 'bg-green-100 text-green-800',
  };

  const statusLabels = {
    novo_pedido: 'Novo',
    em_analise: 'Em Análise',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
    em_producao: 'Em Produção',
    faturado: 'Faturado',
    em_transporte: 'Em Transporte',
    finalizado: 'Finalizado',
  };

  const getStatusBadge = (status) => {
    const badges = {
      novo_pedido: { label: 'Novo', color: 'bg-blue-100 text-blue-800' },
      em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800' },
      aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
      recusado: { label: 'Recusado', color: 'bg-red-100 text-red-800' },
      em_producao: { label: 'Em Produção', color: 'bg-purple-100 text-purple-800' },
      faturado: { label: 'Faturado', color: 'bg-indigo-100 text-indigo-800' },
      em_transporte: { label: 'Em Transporte', color: 'bg-orange-100 text-orange-800' },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' }
    };
    return badges[status] || badges.novo_pedido;
  };

  // Filtrar pedidos
  const filteredPedidos = pedidos.filter(pedido => {
    const matchesSearch = 
      pedido.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClienteNome(pedido.comprador_user_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClienteEmpresa(pedido.comprador_user_id).toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filtroStatus === 'todos' || pedido.status === filtroStatus;

    let matchesMes = true;
    if (filtroMes !== 'todos') {
      const dataPedido = new Date(pedido.created_date);
      const [ano, mes] = filtroMes.split('-');
      matchesMes = dataPedido.getFullYear() === parseInt(ano) && 
                   dataPedido.getMonth() + 1 === parseInt(mes);
    }

    return matchesSearch && matchesStatus && matchesMes;
  });

  // Agrupar por mês de referência para faturamento - not used in rendering, only in the original outline comments.
  // const pedidosPorMesReferencia = {};
  // filteredPedidos.forEach(pedido => {
  //   const mesRef = pedido.mes_referencia || new Date(pedido.created_date).toISOString().slice(0, 7);
  //   if (!pedidosPorMesReferencia[mesRef]) {
  //     pedidosPorMesReferencia[mesRef] = [];
  //   }
  //   pedidosPorMesReferencia[mesRef].push(pedido);
  // });

  // Alertas de pedidos urgentes não faturados
  const pedidosUrgentes = filteredPedidos.filter(p => 
    p.urgente && 
    !['faturado', 'em_transporte', 'finalizado', 'cancelado'].includes(p.status)
  );

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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-600" />
            Gestão de Pedidos
          </h1>
          <p className="text-gray-600">Gerencie pedidos recebidos e faturamento</p>
        </div>
        <Button onClick={handleExportPDF} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Alertas de Pedidos Urgentes */}
      {pedidosUrgentes.length > 0 && (
        <Alert className="bg-red-50 border-red-300">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription>
            <strong className="text-red-900">
              {pedidosUrgentes.length} pedido(s) urgente(s) aguardando faturamento!
            </strong>
            <p className="text-red-800 text-sm mt-1">
              Estes pedidos precisam ser faturados no mês atual.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar por pedido, cliente ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="novo_pedido">Novos</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="faturado">Faturados</SelectItem>
                <SelectItem value="em_transporte">Em Transporte</SelectItem>
                <SelectItem value="finalizado">Finalizados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Meses</SelectItem>
                {Array.from({ length: 12 }, (_, i) => {
                  const now = new Date();
                  const data = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const valor = data.toISOString().slice(0, 7);
                  const label = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                  return (
                    <SelectItem key={`${valor}-${i}`} value={valor}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {filteredPedidos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
              <p className="text-gray-600">Tente ajustar os filtros de busca.</p>
            </CardContent>
          </Card>
        ) : (
          filteredPedidos.map((pedido) => {
            const cliente = clientes.find(c => c.id === pedido.comprador_user_id);
            const fornecedor = fornecedores.find(f => f.id === pedido.fornecedor_id);
            const statusBadge = getStatusBadge(pedido.status); // Keep for the value section
            
            // Verificar se o cliente está inadimplente ou bloqueado
            const clienteInadimplente = cliente?.bloqueado || (cliente?.total_vencido || 0) > 0;
            const clienteBloqueado = cliente?.bloqueado;

            return (
              <Card 
                key={pedido.id} 
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow relative" // Updated card styling
              >
                {/* Alerta de Cliente Inadimplente - Top Right Badge */}
                {clienteInadimplente && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className={clienteBloqueado ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {clienteBloqueado ? 'Cliente Bloqueado' : 'Cliente Inadimplente'}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-gray-900">
                        {cliente?.empresa || cliente?.razao_social || cliente?.nome_marca || 'Cliente não encontrado'}
                      </CardTitle>
                      {cliente?.full_name && (
                        <p className="text-sm text-gray-500">{cliente.full_name}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Pedido #{pedido.id.slice(0, 8)} • {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                      </p>
                      {fornecedor && (
                        <p className="text-sm text-gray-600">
                          Fornecedor: {fornecedor.nome_marca}
                        </p>
                      )}
                    </div>
                    <Badge className={statusColors[pedido.status] || 'bg-gray-100 text-gray-800'}>
                      {statusLabels[pedido.status] || pedido.status}
                    </Badge>
                  </div>
                </CardHeader>

                {/* Alertas de Inadimplência - Detailed Alert */}
                {clienteInadimplente && (
                  <CardContent className="pt-0 pb-3">
                    <Alert className={clienteBloqueado ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}>
                      <AlertTriangle className={`h-4 w-4 ${clienteBloqueado ? 'text-red-600' : 'text-yellow-600'}`} />
                      <AlertDescription className={clienteBloqueado ? 'text-red-800' : 'text-yellow-800'}>
                        {clienteBloqueado ? (
                          <>
                            <strong>Cliente bloqueado por inadimplência.</strong>
                            <br />
                            Motivo: {cliente.motivo_bloqueio || 'Não especificado'}
                            <br />
                            Total em aberto: R$ {(cliente.total_em_aberto || 0).toFixed(2)}
                          </>
                        ) : (
                          <>
                            <strong>Cliente com valores vencidos.</strong>
                            <br />
                            Total vencido: R$ {(cliente.total_vencido || 0).toFixed(2)}
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                )}

                <CardContent className="p-6 pt-0"> {/* Main CardContent, p-6 pt-0 to align with header */}
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Informações do Pedido */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        {/* Title and client info moved to CardHeader */}
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            R$ {pedido.valor_total?.toFixed(2)}
                          </p>
                          <Badge className={`mt-2 ${statusBadge.color}`}>
                            {statusBadge.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Informações Adicionais */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {pedido.metodo_pagamento && (
                          <div>
                            <span className="text-gray-600">Pagamento:</span>
                            <p className="font-medium">{pedido.metodo_pagamento.toUpperCase()}</p>
                          </div>
                        )}
                        {pedido.data_prevista_entrega && (
                          <div>
                            <span className="text-gray-600">Entrega Prevista:</span>
                            <p className="font-medium">
                              {new Date(pedido.data_prevista_entrega).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                        {pedido.codigo_rastreio && (
                          <div>
                            <span className="text-gray-600">Rastreio:</span>
                            <p className="font-medium font-mono text-xs">{pedido.codigo_rastreio}</p>
                          </div>
                        )}
                      </div>

                      {/* Observações */}
                      {pedido.observacoes_comprador && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Obs. do Cliente:</strong> {pedido.observacoes_comprador}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 lg:w-64">
                      {pedido.status === 'novo_pedido' && (
                        <>
                          <Button
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setShowApprovalModal(true);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Aprovar Pedido
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setShowRejectModal(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Recusar
                          </Button>
                        </>
                      )}

                      {['aprovado', 'em_producao'].includes(pedido.status) && !pedido.nf_url && (
                        <>
                          <Button
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setShowFaturarModal(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Faturar Pedido
                          </Button>
                          {pedido.status === 'aprovado' && (
                            <Button
                              variant="outline"
                              onClick={() => handleMudarMetodoPagamento(pedido, pedido.metodo_pagamento === 'boleto' ? 'a_vista' : 'boleto')}
                            >
                              Mudar para {pedido.metodo_pagamento === 'boleto' ? 'À Vista' : 'Boleto'}
                            </Button>
                          )}
                        </>
                      )}

                      {pedido.status === 'faturado' && (
                        <Button
                          onClick={() => {
                            setSelectedPedido(pedido);
                            setShowEnvioModal(true);
                          }}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          Informar Envio
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => {
                          // Abrir modal de detalhes
                          alert('Modal de detalhes - TODO');
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal de Aprovação */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="dataEntrega">Data Prevista de Entrega *</Label>
              <Input
                id="dataEntrega"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowApprovalModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAprovar} className="bg-green-600 hover:bg-green-700">
                Aprovar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Recusa */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="motivoRecusa">Motivo da Recusa *</Label>
              <Textarea
                id="motivoRecusa"
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Explique o motivo da recusa..."
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleRecusar}>
                Confirmar Recusa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Faturamento */}
      <Dialog open={showFaturarModal} onOpenChange={setShowFaturarModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Faturar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nfNumero">Número da Nota Fiscal *</Label>
              <Input
                id="nfNumero"
                value={nfNumero}
                onChange={(e) => setNfNumero(e.target.value)}
                placeholder="Ex: 12345"
              />
            </div>

            <div>
              <Label htmlFor="nfFile">Upload da Nota Fiscal (PDF) *</Label>
              <Input
                id="nfFile"
                type="file"
                accept="application/pdf"
                onChange={(e) => setNfFile(e.target.files[0])}
              />
            </div>

            <div>
              <Label htmlFor="boletoFile">Upload do Boleto (PDF - opcional)</Label>
              <Input
                id="boletoFile"
                type="file"
                accept="application/pdf"
                onChange={(e) => setBoletoFile(e.target.files[0])}
              />
              <p className="text-xs text-gray-500 mt-1">
                Envie o boleto caso o pagamento seja via boleto bancário
              </p>
            </div>

            <div>
              <Label htmlFor="metodoPagamento">Método de Pagamento</Label>
              <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Manter método original" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="a_vista">À Vista</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Deixe em branco para manter o método original
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowFaturarModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleFaturar}
                disabled={uploading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {uploading ? 'Enviando...' : 'Faturar Pedido'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Envio */}
      <Dialog open={showEnvioModal} onOpenChange={setShowEnvioModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar Envio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="transportadora">Transportadora *</Label>
              <Input
                id="transportadora"
                value={transportadora}
                onChange={(e) => setTransportadora(e.target.value)}
                placeholder="Ex: Jadlog, Correios"
              />
            </div>

            <div>
              <Label htmlFor="codigoRastreio">Código de Rastreio</Label>
              <Input
                id="codigoRastreio"
                value={codigoRastreio}
                onChange={(e) => setCodigoRastreio(e.target.value)}
                placeholder="Ex: BR123456789BR"
              />
            </div>

            <div>
              <Label htmlFor="dataEnvio">Data de Envio *</Label>
              <Input
                id="dataEnvio"
                type="date"
                value={dataEnvio}
                onChange={(e) => setDataEnvio(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEnvioModal(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleEnviar}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Confirmar Envio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
