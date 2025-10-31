import React, { useState, useEffect } from 'react';
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
import {
  DollarSign, Calendar, AlertTriangle, CheckCircle, Clock,
  Upload, Download, Filter, TrendingUp, TrendingDown, FileText
} from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDate } from '@/utils/exportUtils';

export default function CarteiraFinanceira() {
  const [user, setUser] = useState(null);
  const [titulos, setTitulos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroFornecedor, setFiltroFornecedor] = useState('todos');
  const [selectedTitulo, setSelectedTitulo] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [comprovanteFile, setComprovanteFile] = useState(null);

  const [stats, setStats] = useState({
    totalAberto: 0,
    totalVencido: 0,
    proximosVencimentos: 0,
    totalPago: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let titulosList = [];
      let fornecedoresList = [];

      if (currentUser.tipo_negocio === 'multimarca') {
        // Cliente vê apenas seus títulos
        titulosList = await Carteira.filter({
          cliente_user_id: currentUser.id
        }, '-data_vencimento');
      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Buscar fornecedor associado ao usuário (relação reversa via responsavel_user_id)
        const fornecedoresListTemp = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
        const fornecedor = fornecedoresListTemp[0];

        if (fornecedor) {
          // Fornecedor vê títulos dos seus pedidos
          titulosList = await Carteira.filter({
            fornecedor_id: fornecedor.id
          }, '-data_vencimento');
        } else {
          console.warn('Fornecedor não encontrado para usuário:', currentUser.id);
          titulosList = [];
        }
      } else if (currentUser.role === 'admin') {
        // Admin vê tudo
        titulosList = await Carteira.list('-data_vencimento');
      }

      fornecedoresList = await Fornecedor.list();

      setTitulos(titulosList || []);
      setFornecedores(fornecedoresList || []);

      calculateStats(titulosList);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
      alert('Selecione um arquivo');
      return;
    }

    setUploadingComprovante(true);
    try {
      // Upload do arquivo
      const formData = new FormData();
      formData.append('file', comprovanteFile);
      
      const uploadResult = await UploadFile({ file: comprovanteFile });
      
      // Atualizar título com comprovante
      await Carteira.update(selectedTitulo.id, {
        comprovante_url: uploadResult.file_url,
        comprovante_data_upload: new Date().toISOString(),
        comprovante_analisado: false
      });

      // Enviar notificação ao fornecedor
      const pedido = await Pedido.get(selectedTitulo.pedido_id);
      await SendEmail({
        to: 'financeiro@polomultimarca.com.br',
        subject: `Comprovante de Pagamento - Pedido #${pedido.id.slice(-8).toUpperCase()}`,
        body: `
          Um novo comprovante de pagamento foi enviado pelo cliente.
          
          Cliente: ${user.nome_empresa || user.full_name}
          Pedido: #${pedido.id.slice(-8).toUpperCase()}
          Valor: R$ ${selectedTitulo.valor.toFixed(2)}
          Vencimento: ${new Date(selectedTitulo.data_vencimento).toLocaleDateString('pt-BR')}
          
          Comprovante: ${uploadResult.file_url}
        `
      });

      alert('Comprovante enviado com sucesso! Aguarde a análise.');
      setShowUploadModal(false);
      setComprovanteFile(null);
      setSelectedTitulo(null);
      loadData();
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      alert('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingComprovante(false);
    }
  };

  const handleAprovarComprovante = async (titulo, aprovado) => {
    try {
      const updateData = {
        comprovante_analisado: true,
        comprovante_aprovado: aprovado
      };

      if (aprovado) {
        updateData.status = 'pago';
        updateData.data_pagamento = new Date().toISOString();
      } else {
        const motivo = prompt('Motivo da recusa:');
        if (!motivo) return;
        updateData.motivo_recusa_comprovante = motivo;
      }

      await Carteira.update(titulo.id, updateData);

      // Atualizar totais do cliente
      if (aprovado) {
        const cliente = await User.get(titulo.cliente_user_id);
        const novoTotalAberto = (cliente.total_em_aberto || 0) - titulo.valor;
        const novoTotalVencido = titulo.status === 'vencido' 
          ? (cliente.total_vencido || 0) - titulo.valor 
          : cliente.total_vencido;

        await User.update(titulo.cliente_user_id, {
          total_em_aberto: Math.max(0, novoTotalAberto),
          total_vencido: Math.max(0, novoTotalVencido)
        });
      }

      // Notificar cliente
      const pedido = await Pedido.get(titulo.pedido_id);
      const cliente = await User.get(titulo.cliente_user_id);
      
      await SendEmail({
        to: cliente.email,
        subject: `Comprovante ${aprovado ? 'Aprovado' : 'Recusado'} - Pedido #${pedido.id.slice(-8).toUpperCase()}`,
        body: aprovado 
          ? `Seu comprovante de pagamento foi aprovado!\n\nPedido: #${pedido.id.slice(-8).toUpperCase()}\nValor: R$ ${titulo.valor.toFixed(2)}`
          : `Seu comprovante de pagamento foi recusado.\n\nMotivo: ${updateData.motivo_recusa_comprovante}\n\nPor favor, envie um novo comprovante.`
      });

      alert(aprovado ? 'Comprovante aprovado!' : 'Comprovante recusado!');
      loadData();
    } catch (error) {
      console.error('Erro ao analisar comprovante:', error);
      alert('Erro ao processar comprovante');
    }
  };

  const getStatusInfo = (titulo) => {
    const hoje = new Date();
    const vencimento = new Date(titulo.data_vencimento);
    const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));

    if (titulo.status === 'pago') {
      return { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    }

    if (diffDias < 0) {
      return { label: `Vencido há ${Math.abs(diffDias)} dias`, color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }

    if (diffDias <= 2) {
      return { label: `Vence em ${diffDias} dia(s)`, color: 'bg-orange-100 text-orange-800', icon: AlertTriangle };
    }

    if (diffDias <= 7) {
      return { label: `Vence em ${diffDias} dias`, color: 'bg-yellow-100 text-yellow-800', icon: Clock };
    }

    return { label: 'Pendente', color: 'bg-blue-100 text-blue-800', icon: Clock };
  };

  const getFornecedorNome = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    return fornecedor?.nome_marca || 'N/A';
  };

  const handleExport = async (format) => {
    try {
      const filteredData = filteredTitulos;

      // Preparar dados para exportação
      const exportData = filteredData.map(titulo => ({
        descricao: titulo.descricao || '',
        tipo: titulo.tipo,
        valor: titulo.valor,
        vencimento: formatDate(titulo.data_vencimento),
        pagamento: titulo.data_pagamento ? formatDate(titulo.data_pagamento) : '',
        status: titulo.status,
        categoria: titulo.categoria || '',
        observacoes: titulo.observacoes || ''
      }));

      // Definir colunas
      const columns = [
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
        await exportToPDF(
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
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar dados.');
    }
  };

  const filteredTitulos = titulos.filter(titulo => {
    const matchesStatus = filtroStatus === 'todos' || titulo.status === filtroStatus;
    const matchesFornecedor = filtroFornecedor === 'todos' || titulo.fornecedor_id === filtroFornecedor;
    
    let matchesVencimento = true;
    if (filtroStatus === 'vencidos') {
      const vencimento = new Date(titulo.data_vencimento);
      matchesVencimento = vencimento < new Date() && titulo.status === 'pendente';
    }
    
    return matchesStatus && matchesFornecedor && matchesVencimento;
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
      {stats.proximosVencimentos > 0 && user?.tipo_negocio === 'multimarca' && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Atenção!</strong> Você tem {stats.proximosVencimentos} título(s) vencendo nos próximos 7 dias.
          </AlertDescription>
        </Alert>
      )}

      {stats.totalVencido > 0 && user?.tipo_negocio === 'multimarca' && (
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
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label>Status</Label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full p-2 rounded-lg border bg-white"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="vencidos">Vencidos</option>
                <option value="pago">Pagos</option>
                <option value="em_analise">Em Análise</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <Label>Fornecedor</Label>
              <select
                value={filtroFornecedor}
                onChange={(e) => setFiltroFornecedor(e.target.value)}
                className="w-full p-2 rounded-lg border bg-white"
              >
                <option value="todos">Todos</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.nome_marca}</option>
                ))}
              </select>
            </div>
          </div>
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

              return (
                <div key={titulo.id} className="p-4 bg-white rounded-lg shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline">
                          {getFornecedorNome(titulo.fornecedor_id)}
                        </Badge>
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Valor:</span>
                          <span className="font-bold ml-2">R$ {titulo.valor?.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Vencimento:</span>
                          <span className="ml-2">{new Date(titulo.data_vencimento).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {titulo.data_pagamento && (
                          <div>
                            <span className="text-gray-600">Pago em:</span>
                            <span className="ml-2">{new Date(titulo.data_pagamento).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>

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

                    <div className="flex gap-2">
                      {user?.tipo_negocio === 'multimarca' && titulo.status === 'pendente' && (
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

                      {user?.role === 'admin' && titulo.comprovante_url && !titulo.comprovante_analisado && (
                        <>
                          <Button
                            onClick={() => handleAprovarComprovante(titulo, true)}
                            size="sm"
                            className="bg-green-600"
                          >
                            Aprovar
                          </Button>
                          <Button
                            onClick={() => handleAprovarComprovante(titulo, false)}
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
                <p className="text-2xl font-bold">R$ {selectedTitulo.valor?.toFixed(2)}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Vencimento: {new Date(selectedTitulo.data_vencimento).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            <div>
              <Label>Selecione o comprovante (PDF, JPG, PNG)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovanteFile(e.target.files[0])}
                className="mt-2"
              />
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
                  setSelectedTitulo(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadComprovante}
                disabled={!comprovanteFile || uploadingComprovante}
                className="bg-blue-600"
              >
                {uploadingComprovante ? 'Enviando...' : 'Enviar Comprovante'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}