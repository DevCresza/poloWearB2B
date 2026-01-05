
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Pedido } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Package, Clock, CheckCircle, Truck, X, Eye, FileText,
  Download, CreditCard, Calendar, MapPin, Receipt, Upload,
  AlertTriangle, ArrowUpCircle, DollarSign
} from 'lucide-react';
import { formatCurrency } from '@/utils/exportUtils';

export default function MeusPedidos() {
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
  const [filterStatus, setFilterStatus] = useState('all');
  const [comprovanteFile, setComprovanteFile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      const [pedidosList, fornecedoresList, carteiraList] = await Promise.all([
        Pedido.filter({ comprador_user_id: currentUser.id }, '-created_date'),
        Fornecedor.list(),
        Carteira.filter({ cliente_user_id: currentUser.id })
      ]);
      
      setUser(currentUser);
      setPedidos(pedidosList || []);
      setFornecedores(fornecedoresList || []);
      setCarteira(carteiraList || []);
    } catch (error) {
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
      finalizado: { 
        label: 'Finalizado', 
        color: 'bg-green-100 text-green-800', 
        icon: CheckCircle,
        description: 'Pedido entregue com sucesso'
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

  const handleConfirmacao = async (pedidoId, tipo) => {
    try {
      const updateData = {};
      
      if (tipo === 'boleto') {
        updateData.cliente_confirmou_boleto = true;
      } else if (tipo === 'nf') {
        updateData.cliente_confirmou_nf = true;
      } else if (tipo === 'recebimento') {
        updateData.cliente_confirmou_recebimento = true;
      }
      
      await Pedido.update(pedidoId, updateData);
      toast.success('Confirmação registrada com sucesso!');
      loadData();
      
      if (showDetailsModal) {
        const pedidoAtualizado = await Pedido.get(pedidoId);
        setSelectedPedido(pedidoAtualizado);
      }
    } catch (error) {
      toast.error('Erro ao registrar confirmação. Tente novamente.');
    }
  };

  const handleUploadComprovante = async (tituloId, file) => {
    setUploadingComprovante(true);
    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

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
    } catch (error) {
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingComprovante(false);
    }
  };

  // Enviar comprovante diretamente no pedido
  const handleEnviarComprovantePedido = async () => {
    if (!comprovanteFile || !selectedPedido) {
      toast.info('Selecione o arquivo do comprovante');
      return;
    }

    setUploadingComprovante(true);
    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file: comprovanteFile });

      // Atualizar pedido com comprovante
      await Pedido.update(selectedPedido.id, {
        comprovante_pagamento_url: file_url,
        comprovante_pagamento_data: new Date().toISOString(),
        status_pagamento: 'em_analise'
      });

      toast.success('Comprovante enviado com sucesso! O fornecedor irá analisar e confirmar o pagamento.');
      setShowComprovanteModal(false);
      setComprovanteFile(null);
      setSelectedPedido(null);
      loadData();
    } catch (error) {
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingComprovante(false);
    }
  };

  const getFornecedorNome = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    return fornecedor ? fornecedor.nome_marca : 'N/A';
  };

  const filteredPedidos = pedidos.filter(pedido => {
    const matchesSearch = pedido.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getFornecedorNome(pedido.fornecedor_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || pedido.status === filterStatus;
    return matchesSearch && matchesStatus;
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
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Buscar por ID do pedido ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-xl shadow-neumorphic-inset"
            />
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border bg-white shadow-neumorphic-inset"
            >
              <option value="all">Todos os Status</option>
              <option value="novo_pedido">Novos</option>
              <option value="em_analise">Em Análise</option>
              <option value="aprovado">Aprovados</option>
              <option value="em_producao">Em Produção</option>
              <option value="faturado">Faturados</option>
              <option value="em_transporte">Em Transporte</option>
              <option value="finalizado">Finalizados</option>
            </select>

            <Button 
              onClick={() => setShowFinanceiroModal(true)}
              className="bg-green-600 hover:bg-green-700 rounded-xl"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Carteira Financeira
            </Button>
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
                {searchTerm || filterStatus !== 'all' 
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
                          <p className="text-xs text-gray-500 mt-1">
                            Realizado em {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
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
                            Previsão de entrega: {new Date(pedido.data_prevista_entrega).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}

                      {pedido.codigo_rastreio && (
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="w-4 h-4 text-orange-600" />
                          <span className="text-gray-600">Rastreio:</span>
                          <code className="bg-gray-200 px-2 py-1 rounded">{pedido.codigo_rastreio}</code>
                        </div>
                      )}

                      {/* Alertas e Ações */}
                      <div className="flex flex-wrap gap-2">
                        {pedido.status === 'faturado' && pedido.nf_url && !pedido.cliente_confirmou_nf && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirmacao(pedido.id, 'nf')}
                            className="rounded-lg"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Recebimento da NF
                          </Button>
                        )}
                        
                        {pedido.status === 'faturado' && pedido.boleto_url && !pedido.cliente_confirmou_boleto && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirmacao(pedido.id, 'boleto')}
                            className="rounded-lg"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Recebimento do Boleto
                          </Button>
                        )}
                        
                        {pedido.status === 'em_transporte' && !pedido.cliente_confirmou_recebimento && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirmacao(pedido.id, 'recebimento')}
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

                      {/* Botão para enviar comprovante de pagamento */}
                      {pedido.boleto_url && pedido.status_pagamento !== 'pago' && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedPedido(pedido);
                            setShowComprovanteModal(true);
                          }}
                          className={`w-full rounded-xl ${pedido.comprovante_pagamento_url ? 'border-green-300 text-green-700' : 'border-orange-300 text-orange-700'}`}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {pedido.comprovante_pagamento_url ? 'Atualizar Comprovante' : 'Enviar Comprovante'}
                        </Button>
                      )}

                      {/* Ver comprovante enviado */}
                      {pedido.comprovante_pagamento_url && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(pedido.comprovante_pagamento_url, '_blank')}
                          className="w-full rounded-xl border-blue-300 text-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Comprovante
                        </Button>
                      )}
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
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Detalhes do Pedido #{selectedPedido.id.slice(-8).toUpperCase()}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Status Atual */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status Atual</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const statusInfo = getStatusInfo(selectedPedido.status);
                    return (
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${statusInfo.color}`}>
                          <statusInfo.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{statusInfo.label}</h4>
                          <p className="text-gray-600">{statusInfo.description}</p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Itens do Pedido */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(Array.isArray(selectedPedido.itens) ? selectedPedido.itens : JSON.parse(selectedPedido.itens || '[]')).map((item, index) => (
                      <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${item.tipo === 'capsula' ? 'bg-purple-50 border-2 border-purple-200' : 'bg-gray-50'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {item.tipo === 'capsula' && (
                              <Badge className="bg-purple-600 text-white text-xs">CÁPSULA</Badge>
                            )}
                            <p className="font-medium">{item.nome}</p>
                          </div>
                          <p className="text-sm text-gray-600">
                            {item.tipo === 'capsula'
                              ? `${item.quantidade} cápsula(s)`
                              : item.tipo_venda === 'grade'
                                ? `${item.quantidade} grade(s)`
                                : `${item.quantidade} unidade(s)`
                            }
                          </p>
                        </div>
                        <p className="font-semibold text-blue-600">
                          {formatCurrency(item.preco * item.quantidade)}
                        </p>
                      </div>
                    ))}
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-blue-600">{formatCurrency(selectedPedido.valor_total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Endereço de Entrega */}
              {selectedPedido.endereco_entrega && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Endereço de Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-gray-700 space-y-1">
                      <p>{selectedPedido.endereco_entrega.rua}, {selectedPedido.endereco_entrega.numero}</p>
                      {selectedPedido.endereco_entrega.complemento && (
                        <p>{selectedPedido.endereco_entrega.complemento}</p>
                      )}
                      <p>{selectedPedido.endereco_entrega.bairro}</p>
                      <p>{selectedPedido.endereco_entrega.cidade} - {selectedPedido.endereco_entrega.estado}</p>
                      <p>CEP: {selectedPedido.endereco_entrega.cep}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observações */}
              {selectedPedido.observacoes_comprador && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Suas Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedPedido.observacoes_comprador}</p>
                  </CardContent>
                </Card>
              )}

              {/* Motivo de Recusa */}
              {selectedPedido.status === 'recusado' && selectedPedido.motivo_recusa && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Motivo da Recusa:</strong> {selectedPedido.motivo_recusa}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </DialogContent>
        </Dialog>
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
                      const vencimento = new Date(titulo.data_vencimento);
                      const hoje = new Date();
                      const vencido = vencimento < hoje && titulo.status === 'pendente';
                      
                      return (
                        <Card key={titulo.id} className={vencido ? 'border-red-300 bg-red-50' : ''}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-semibold">
                                    Pedido #{titulo.pedido_id.slice(-8).toUpperCase()}
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
                                <div>
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        handleUploadComprovante(titulo.id, file);
                                      }
                                    }}
                                    className="hidden"
                                    id={`upload-${titulo.id}`}
                                  />
                                  <p className="text-xs text-gray-500 mb-1"><strong>Formatos:</strong> PDF, JPG, PNG</p>
                                  <label htmlFor={`upload-${titulo.id}`}>
                                    <Button
                                      type="button"
                                      onClick={() => document.getElementById(`upload-${titulo.id}`).click()}
                                      disabled={uploadingComprovante}
                                      className="cursor-pointer"
                                    >
                                      <Upload className="w-4 h-4 mr-2" />
                                      {uploadingComprovante ? 'Enviando...' : 'Enviar Comprovante'}
                                    </Button>
                                  </label>
                                </div>
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

      {/* Modal de Envio de Comprovante de Pagamento */}
      <Dialog open={showComprovanteModal} onOpenChange={setShowComprovanteModal}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Enviar Comprovante de Pagamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedPedido && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-gray-600">
                  Pedido #{selectedPedido.id.slice(-8).toUpperCase()}
                </p>
                <p className="font-semibold text-lg text-blue-600">
                  {formatCurrency(selectedPedido.valor_total)}
                </p>
                {selectedPedido.comprovante_pagamento_url && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Comprovante já enviado</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() => window.open(selectedPedido.comprovante_pagamento_url, '_blank')}
                    >
                      Ver
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Arquivo do Comprovante *
              </label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovanteFile(e.target.files[0])}
                className="rounded-xl"
              />
              <p className="text-xs text-gray-500 mt-1">
                <strong>Formatos aceitos:</strong> PDF, JPG, JPEG, PNG
              </p>
              <p className="text-xs text-gray-500">
                Envie o comprovante de pagamento (PIX, transferência, depósito).
                O fornecedor irá analisar e confirmar o pagamento.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowComprovanteModal(false);
                  setComprovanteFile(null);
                  setSelectedPedido(null);
                }}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEnviarComprovantePedido}
                disabled={uploadingComprovante || !comprovanteFile}
                className="bg-green-600 hover:bg-green-700 rounded-xl"
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
