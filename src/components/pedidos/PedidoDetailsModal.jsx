import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, MapPin, DollarSign, Calendar, FileText,
  Download, CheckCircle, Clock, Truck, User, Building,
  Phone, Mail, CreditCard, Upload, AlertTriangle
} from 'lucide-react';
import { Pedido } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { User as UserEntity } from '@/api/entities';
import { UploadFile, SendEmail } from '@/api/integrations';
import { formatDateTime } from '@/utils/exportUtils';

export default function PedidoDetailsModal({ pedido, onClose, onUpdate, currentUser, userMap, fornecedorMap }) {
  const [confirmando, setConfirmando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [boletoFile, setBoletoFile] = useState(null);
  const [nfFile, setNfFile] = useState(null);
  const [nfNumero, setNfNumero] = useState(pedido.nf_numero || '');

  // Estados para parcelas/títulos
  const [parcelas, setParcelas] = useState([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState(null);
  const [showUploadParcelaModal, setShowUploadParcelaModal] = useState(false);
  const [comprovanteParcelaFile, setComprovanteParcelaFile] = useState(null);
  const [dataPagamentoParcela, setDataPagamentoParcela] = useState('');
  const [uploadingParcela, setUploadingParcela] = useState(false);

  // Verificar se usuário pode fazer upload (fornecedor ou admin)
  const canUpload = currentUser?.role === 'admin' || currentUser?.tipo_negocio === 'fornecedor';

  // Carregar parcelas do pedido
  useEffect(() => {
    const loadParcelas = async () => {
      if (!pedido?.id) return;
      setLoadingParcelas(true);
      try {
        const titulosList = await Carteira.filter({ pedido_id: pedido.id });
        // Ordenar por data de vencimento
        const sorted = (titulosList || []).sort((a, b) =>
          new Date(a.data_vencimento) - new Date(b.data_vencimento)
        );
        setParcelas(sorted);
      } catch (error) {
        console.error('Erro ao carregar parcelas:', error);
      } finally {
        setLoadingParcelas(false);
      }
    };
    loadParcelas();
  }, [pedido?.id]);

  // Upload de Boleto
  const handleUploadBoleto = async () => {
    if (!boletoFile) {
      toast.info('Selecione o arquivo do boleto');
      return;
    }
    setUploading(true);
    try {
      const result = await UploadFile({ file: boletoFile });
      await Pedido.update(pedido.id, {
        boleto_url: result.file_url,
        boleto_data_upload: new Date().toISOString()
      });
      toast.success('Boleto enviado com sucesso!');
      setBoletoFile(null);
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao enviar boleto');
    } finally {
      setUploading(false);
    }
  };

  // Upload de Nota Fiscal
  const handleUploadNF = async () => {
    if (!nfFile) {
      toast.info('Selecione o arquivo da nota fiscal');
      return;
    }
    setUploading(true);
    try {
      const result = await UploadFile({ file: nfFile });
      await Pedido.update(pedido.id, {
        nf_url: result.file_url,
        nf_numero: nfNumero,
        nf_data_upload: new Date().toISOString(),
        status: pedido.status === 'em_producao' ? 'faturado' : pedido.status
      });
      toast.success('Nota Fiscal enviada com sucesso!');
      setNfFile(null);
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao enviar nota fiscal');
    } finally {
      setUploading(false);
    }
  };

  // Alterar status de pagamento
  const handleAlterarStatusPagamento = async (novoStatus) => {
    try {
      const updateData = {
        status_pagamento: novoStatus
      };

      // Se marcou como pago, registrar data de pagamento
      if (novoStatus === 'pago') {
        updateData.data_pagamento = new Date().toISOString().split('T')[0];
      }

      await Pedido.update(pedido.id, updateData);
      toast.success('Status de pagamento atualizado!');
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const getMetodoPagamentoLabel = (metodo) => {
    const labels = {
      'pix': 'PIX',
      'cartao_credito': 'Cartão de Crédito',
      'boleto': 'Boleto',
      'boleto_faturado': 'Boleto Faturado (30 dias)',
      'transferencia': 'Transferência Bancária',
      'a_vista': 'À Vista'
    };
    return labels[metodo] || metodo;
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      novo_pedido: { label: 'Novo Pedido', color: 'bg-blue-100 text-blue-800', icon: Clock },
      em_producao: { label: 'Em Produção', color: 'bg-purple-100 text-purple-800', icon: Package },
      faturado: { label: 'Faturado', color: 'bg-indigo-100 text-indigo-800', icon: FileText },
      em_transporte: { label: 'Em Transporte', color: 'bg-orange-100 text-orange-800', icon: Truck },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: Clock }
    };
    return statusMap[status] || statusMap.novo_pedido;
  };

  const statusInfo = getStatusInfo(pedido.status);
  const StatusIcon = statusInfo.icon;

  const handleConfirmarRecebimento = async (tipo) => {
    setConfirmando(true);
    try {
      const updateData = {};
      if (tipo === 'boleto') updateData.cliente_confirmou_boleto = true;
      if (tipo === 'nf') updateData.cliente_confirmou_nf = true;
      if (tipo === 'produto') updateData.cliente_confirmou_recebimento = true;

      await Pedido.update(pedido.id, updateData);
      onUpdate();
      toast.success('Confirmação registrada com sucesso!');
    } catch (_error) {
      toast.error('Erro ao registrar confirmação');
    } finally {
      setConfirmando(false);
    }
  };

  // Função para obter info de status da parcela
  const getParcelaStatusInfo = (parcela) => {
    // Se já está pago, retornar status pago
    if (parcela.status === 'pago') {
      return { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    }

    // Se está em análise
    if (parcela.status === 'em_analise') {
      return { label: 'Em Análise', color: 'bg-blue-100 text-blue-800', icon: Clock };
    }

    // Verificar se está vencido
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(parcela.data_vencimento + 'T00:00:00');
    const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return { label: `Vencido há ${Math.abs(diffDias)} dias`, color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }

    if (diffDias === 0) {
      return { label: 'Vence hoje', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle };
    }

    if (diffDias <= 7) {
      return { label: `Vence em ${diffDias} dia(s)`, color: 'bg-yellow-100 text-yellow-800', icon: Clock };
    }

    return { label: 'Pendente', color: 'bg-gray-100 text-gray-800', icon: Clock };
  };

  // Função para enviar comprovante de parcela
  const handleUploadComprovanteParcela = async () => {
    if (!comprovanteParcelaFile || !parcelaSelecionada) {
      toast.info('Selecione um arquivo');
      return;
    }

    if (!dataPagamentoParcela) {
      toast.info('Informe a data em que o pagamento foi realizado');
      return;
    }

    setUploadingParcela(true);
    try {
      const uploadResult = await UploadFile({ file: comprovanteParcelaFile });

      // Atualizar título com comprovante e data informada
      await Carteira.update(parcelaSelecionada.id, {
        comprovante_url: uploadResult.file_url,
        comprovante_data_upload: new Date().toISOString(),
        comprovante_analisado: false,
        data_pagamento_informada: dataPagamentoParcela,
        status: 'em_analise'
      });

      // Enviar notificação ao fornecedor
      await SendEmail({
        to: 'financeiro@polomultimarca.com.br',
        subject: `Comprovante de Pagamento - Pedido #${pedido.id.slice(-8).toUpperCase()} - Parcela ${parcelas.findIndex(p => p.id === parcelaSelecionada.id) + 1}`,
        body: `
          Um novo comprovante de pagamento foi enviado pelo cliente.

          Cliente: ${currentUser?.empresa || currentUser?.full_name}
          Pedido: #${pedido.id.slice(-8).toUpperCase()}
          Parcela: ${parcelas.findIndex(p => p.id === parcelaSelecionada.id) + 1} de ${parcelas.length}
          Valor: R$ ${parcelaSelecionada.valor?.toFixed(2)}
          Vencimento: ${new Date(parcelaSelecionada.data_vencimento).toLocaleDateString('pt-BR')}
          Data do Pagamento Informada: ${new Date(dataPagamentoParcela + 'T12:00:00').toLocaleDateString('pt-BR')}

          Comprovante: ${uploadResult.file_url}
        `
      });

      toast.success('Comprovante enviado com sucesso! Aguarde a análise.');

      // Recarregar parcelas
      const titulosList = await Carteira.filter({ pedido_id: pedido.id });
      const sorted = (titulosList || []).sort((a, b) =>
        new Date(a.data_vencimento) - new Date(b.data_vencimento)
      );
      setParcelas(sorted);

      // Fechar modal e limpar estados
      setShowUploadParcelaModal(false);
      setComprovanteParcelaFile(null);
      setDataPagamentoParcela('');
      setParcelaSelecionada(null);
    } catch (_error) {
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setUploadingParcela(false);
    }
  };

  let itens = [];
  try {
    itens = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
  } catch (_e) {
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <Package className="w-6 h-6" />
            Pedido #{pedido.id.slice(-8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status e Informações Principais */}
          <div className="flex flex-wrap gap-4">
            <Badge className={`${statusInfo.color} text-lg px-4 py-2`}>
              <StatusIcon className="w-5 h-5 mr-2" />
              {statusInfo.label}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2">
              <DollarSign className="w-5 h-5 mr-2" />
              R$ {pedido.valor_total?.toFixed(2)}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Calendar className="w-5 h-5 mr-2" />
              {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
            </Badge>
          </div>

          {/* Informações do Cliente e Fornecedor */}
          {(userMap || fornecedorMap) && (
            <div className="grid md:grid-cols-2 gap-4">
              {userMap && pedido.comprador_user_id && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Cliente</h4>
                  </div>
                  <p className="text-gray-800 font-medium">
                    {userMap.get(pedido.comprador_user_id) || 'Cliente não encontrado'}
                  </p>
                </div>
              )}
              {fornecedorMap && pedido.fornecedor_id && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Fornecedor</h4>
                  </div>
                  <p className="text-gray-800 font-medium">
                    {fornecedorMap.get(pedido.fornecedor_id) || 'Fornecedor não encontrado'}
                  </p>
                </div>
              )}
            </div>
          )}

          <Tabs defaultValue="itens" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="itens">Itens do Pedido</TabsTrigger>
              <TabsTrigger value="entrega">Entrega</TabsTrigger>
              <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            {/* Tab: Itens do Pedido */}
            <TabsContent value="itens" className="space-y-4">
              {itens.map((item, index) => {
                // Foto pode ser string URL ou objeto {url, cor_nome, cor_codigo_hex}
                const fotoUrl = typeof item.foto === 'string' ? item.foto : item.foto?.url;
                return (
                <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  {fotoUrl && (
                    <img
                      src={fotoUrl}
                      alt={item.nome}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{item.nome}</h4>
                    <p className="text-sm text-gray-600">{item.marca}</p>
                    {item.referencia && (
                      <p className="text-xs text-gray-500">Ref: {item.referencia}</p>
                    )}

                    {/* Mostrar cor selecionada se houver */}
                    {item.cor_selecionada && item.cor_selecionada.cor_nome && (
                      <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-medium text-gray-600">Cor:</span>
                        <div
                          className="w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm"
                          style={{ backgroundColor: item.cor_selecionada.cor_codigo_hex || item.cor_selecionada.cor_hex || '#000000' }}
                        />
                        <span className="text-sm font-semibold text-gray-900">{item.cor_selecionada.cor_nome}</span>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-4 flex-wrap">
                      <Badge variant="outline">
                        {item.tipo_venda === 'grade' ? 'Grade Completa' : 'Unitário'}
                      </Badge>
                      <span className="text-sm">
                        Quantidade: <strong>{item.quantidade}</strong>
                      </span>
                      <span className="text-sm">
                        Preço Unit: <strong>R$ {item.preco?.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">
                      R$ {item.total?.toFixed(2)}
                    </p>
                  </div>
                </div>
              );})}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Valor Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    R$ {pedido.valor_total?.toFixed(2)}
                  </span>
                </div>
              </div>

              {pedido.observacoes_comprador && (
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Observações do Cliente:</h4>
                  <p className="text-gray-700">{pedido.observacoes_comprador}</p>
                </div>
              )}

              {pedido.observacoes_fornecedor && currentUser?.role === 'admin' && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Observações Internas (Fornecedor):</h4>
                  <p className="text-gray-700">{pedido.observacoes_fornecedor}</p>
                </div>
              )}
            </TabsContent>

            {/* Tab: Entrega */}
            <TabsContent value="entrega" className="space-y-4">
              {pedido.endereco_entrega && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold">Endereço de Entrega:</h4>
                  </div>
                  <div className="space-y-1 text-gray-700">
                    {pedido.endereco_entrega.destinatario && (
                      <p><strong>Destinatário:</strong> {pedido.endereco_entrega.destinatario}</p>
                    )}
                    {pedido.endereco_entrega.telefone && (
                      <p><strong>Telefone:</strong> {pedido.endereco_entrega.telefone}</p>
                    )}
                    {pedido.endereco_entrega.endereco && (
                      <p>{pedido.endereco_entrega.endereco}</p>
                    )}
                    <p>{pedido.endereco_entrega.cidade} - {pedido.endereco_entrega.estado}</p>
                    <p>CEP: {pedido.endereco_entrega.cep}</p>
                  </div>
                </div>
              )}

              {pedido.data_prevista_entrega && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">Data Prevista de Entrega:</span>
                    <span>{new Date(pedido.data_prevista_entrega).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}

              {pedido.transportadora && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-5 h-5 text-orange-600" />
                    <h4 className="font-semibold">Informações de Transporte:</h4>
                  </div>
                  <p className="text-gray-700">Transportadora: <strong>{pedido.transportadora}</strong></p>
                  {pedido.codigo_rastreio && (
                    <div className="mt-2">
                      <p className="text-gray-700">Código de Rastreio: <strong>{pedido.codigo_rastreio}</strong></p>
                      {pedido.link_rastreio ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => window.open(pedido.link_rastreio, '_blank')}
                        >
                          Rastrear Pedido
                        </Button>
                      ) : (
                        <p className="text-sm text-gray-500 mt-2">Link de rastreio não disponível</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(pedido.status === 'em_transporte' || pedido.status === 'finalizado') && (
                pedido.cliente_confirmou_recebimento ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Recebimento confirmado pelo cliente
                    </AlertDescription>
                  </Alert>
                ) : currentUser?.tipo_negocio === 'multimarca' ? (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="flex items-center justify-between">
                      <span>Confirme o recebimento do produto:</span>
                      <Button
                        onClick={() => handleConfirmarRecebimento('produto')}
                        disabled={confirmando}
                        className="bg-green-600"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Recebimento
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      Aguardando confirmação de recebimento pelo cliente
                    </AlertDescription>
                  </Alert>
                )
              )}
            </TabsContent>

            {/* Tab: Pagamento */}
            <TabsContent value="pagamento" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold">Forma de Pagamento:</h4>
                  </div>
                  {pedido.metodo_pagamento ? (
                    <>
                      <p className="text-lg font-medium">{getMetodoPagamentoLabel(pedido.metodo_pagamento)}</p>
                      {pedido.metodo_pagamento_original && pedido.metodo_pagamento_original !== pedido.metodo_pagamento && (
                        <p className="text-sm text-gray-600 mt-1">
                          (Alterado de: {getMetodoPagamentoLabel(pedido.metodo_pagamento_original)})
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">Não informado</p>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold">Status do Pagamento:</h4>
                  </div>
                  {canUpload ? (
                    <Select
                      value={pedido.status_pagamento || 'pendente'}
                      onValueChange={handleAlterarStatusPagamento}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_analise">Em Análise</SelectItem>
                        <SelectItem value="pago">Pago / Confirmado</SelectItem>
                        <SelectItem value="atrasado">Atrasado</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={
                      pedido.status_pagamento === 'pago' ? 'bg-green-100 text-green-800' :
                      pedido.status_pagamento === 'atrasado' ? 'bg-red-100 text-red-800' :
                      pedido.status_pagamento === 'em_analise' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }>
                      {pedido.status_pagamento || 'pendente'}
                    </Badge>
                  )}
                </div>
              </div>

              {pedido.data_pagamento && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold">Pagamento Confirmado em:</span>
                    <span>{new Date(pedido.data_pagamento).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}

              {/* Parcelas/Títulos do Pedido */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-lg">Parcelas do Pedido</h4>
                  {parcelas.length > 0 && (
                    <Badge variant="outline">{parcelas.length} parcela(s)</Badge>
                  )}
                </div>

                {loadingParcelas ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : parcelas.length > 0 ? (
                  <div className="space-y-3">
                    {parcelas.map((parcela, index) => {
                      const statusInfo = getParcelaStatusInfo(parcela);
                      const StatusIconParcela = statusInfo.icon;
                      return (
                        <div key={parcela.id} className="p-4 bg-gray-50 rounded-lg border">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-gray-700">
                                  Parcela {index + 1} de {parcelas.length}
                                </span>
                                <Badge className={statusInfo.color}>
                                  <StatusIconParcela className="w-3 h-3 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Valor:</span>
                                  <span className="font-bold ml-2">R$ {parcela.valor?.toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Vencimento:</span>
                                  <span className="ml-2">{new Date(parcela.data_vencimento).toLocaleDateString('pt-BR')}</span>
                                </div>
                                {parcela.data_pagamento && (
                                  <div>
                                    <span className="text-gray-500">Pago em:</span>
                                    <span className="ml-2 text-green-600 font-medium">{new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')}</span>
                                  </div>
                                )}
                              </div>

                              {/* Status do comprovante */}
                              {parcela.comprovante_url && (
                                <div className="mt-2 flex items-center gap-2">
                                  {parcela.comprovante_analisado ? (
                                    parcela.comprovante_aprovado ? (
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
                                    onClick={() => window.open(parcela.comprovante_url, '_blank')}
                                  >
                                    <FileText className="w-4 h-4 mr-1" />
                                    Ver Comprovante
                                  </Button>
                                </div>
                              )}

                              {/* Motivo da recusa */}
                              {parcela.motivo_recusa_comprovante && (
                                <Alert className="mt-2 border-red-200 bg-red-50">
                                  <AlertDescription className="text-red-800 text-sm">
                                    <strong>Motivo da recusa:</strong> {parcela.motivo_recusa_comprovante}
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>

                            {/* Botão de ação */}
                            <div className="flex gap-2">
                              {currentUser?.tipo_negocio === 'multimarca' && parcela.status === 'pendente' && (
                                <Button
                                  onClick={() => {
                                    setParcelaSelecionada(parcela);
                                    setShowUploadParcelaModal(true);
                                  }}
                                  size="sm"
                                  className="bg-blue-600"
                                >
                                  <Upload className="w-4 h-4 mr-1" />
                                  Enviar Comprovante
                                </Button>
                              )}

                              {/* Botão para reenviar comprovante se foi recusado */}
                              {currentUser?.tipo_negocio === 'multimarca' &&
                               parcela.comprovante_analisado &&
                               !parcela.comprovante_aprovado && (
                                <Button
                                  onClick={() => {
                                    setParcelaSelecionada(parcela);
                                    setShowUploadParcelaModal(true);
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="border-orange-500 text-orange-600"
                                >
                                  <Upload className="w-4 h-4 mr-1" />
                                  Reenviar Comprovante
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Resumo das parcelas */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="font-bold ml-2">R$ {parcelas.reduce((sum, p) => sum + (p.valor || 0), 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Pagas:</span>
                          <span className="font-bold ml-2 text-green-600">
                            {parcelas.filter(p => p.status === 'pago').length} de {parcelas.length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Em Análise:</span>
                          <span className="font-bold ml-2 text-blue-600">
                            {parcelas.filter(p => p.status === 'em_analise').length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Pendentes:</span>
                          <span className="font-bold ml-2 text-orange-600">
                            {parcelas.filter(p => p.status === 'pendente').length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
                    <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Nenhuma parcela cadastrada para este pedido</p>
                    <p className="text-sm text-gray-400">As parcelas serão geradas quando o pedido for faturado</p>
                  </div>
                )}
              </div>

              {/* Comprovante de Pagamento do Cliente (legado - do pedido) */}
              {pedido.comprovante_pagamento_url && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold text-purple-900">Comprovante de Pagamento (Geral)</h4>
                        <Badge className="bg-purple-100 text-purple-800">Enviado pelo cliente</Badge>
                      </div>
                      {pedido.comprovante_pagamento_data && (
                        <p className="text-sm text-gray-600">
                          Enviado em: {formatDateTime(pedido.comprovante_pagamento_data)}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => window.open(pedido.comprovante_pagamento_url, '_blank')}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Ver Comprovante
                    </Button>
                  </div>
                  {canUpload && pedido.status_pagamento !== 'pago' && (
                    <div className="mt-3 pt-3 border-t border-purple-200">
                      <p className="text-sm text-purple-800">
                        O cliente enviou o comprovante. Verifique e altere o status para "Pago" se estiver correto.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab: Documentos */}
            <TabsContent value="documentos" className="space-y-4">
              {/* Boleto */}
              {pedido.boleto_url ? (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold">Boleto</h4>
                      </div>
                      {pedido.boleto_data_upload && (
                        <p className="text-sm text-gray-600">
                          Enviado em: {formatDateTime(pedido.boleto_data_upload)}
                        </p>
                      )}
                      {pedido.cliente_confirmou_boleto && (
                        <Badge className="bg-green-100 text-green-800 mt-2">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Confirmado pelo cliente
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => window.open(pedido.boleto_url, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </Button>
                      {!pedido.cliente_confirmou_boleto && currentUser?.tipo_negocio === 'multimarca' && (
                        <Button
                          onClick={() => handleConfirmarRecebimento('boleto')}
                          disabled={confirmando}
                          size="sm"
                          className="bg-green-600"
                        >
                          Confirmar Recebimento
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Permitir atualizar o boleto se for fornecedor/admin */}
                  {canUpload && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <p className="text-sm text-gray-600 mb-2">Atualizar Boleto:</p>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.crm"
                          onChange={(e) => setBoletoFile(e.target.files[0])}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleUploadBoleto}
                          disabled={uploading || !boletoFile}
                          size="sm"
                        >
                          {uploading ? 'Enviando...' : 'Atualizar'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h4 className="font-semibold text-gray-600">Boleto</h4>
                  </div>
                  {canUpload ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">Nenhum boleto anexado. Faça o upload:</p>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.crm"
                        onChange={(e) => setBoletoFile(e.target.files[0])}
                      />
                      <p className="text-xs text-gray-500"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                      <Button
                        onClick={handleUploadBoleto}
                        disabled={uploading || !boletoFile}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Enviando...' : 'Enviar Boleto'}
                      </Button>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Boleto ainda não disponível
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Nota Fiscal */}
              {pedido.nf_url ? (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-green-600" />
                        <h4 className="font-semibold">Nota Fiscal</h4>
                      </div>
                      {pedido.nf_numero && (
                        <p className="text-sm text-gray-600">NF: {pedido.nf_numero}</p>
                      )}
                      {pedido.nf_data_upload && (
                        <p className="text-sm text-gray-600">
                          Enviada em: {formatDateTime(pedido.nf_data_upload)}
                        </p>
                      )}
                      {pedido.cliente_confirmou_nf && (
                        <Badge className="bg-green-100 text-green-800 mt-2">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Confirmada pelo cliente
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => window.open(pedido.nf_url, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </Button>
                      {!pedido.cliente_confirmou_nf && currentUser?.tipo_negocio === 'multimarca' && (
                        <Button
                          onClick={() => handleConfirmarRecebimento('nf')}
                          disabled={confirmando}
                          size="sm"
                          className="bg-green-600"
                        >
                          Confirmar Recebimento
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Permitir atualizar a NF se for fornecedor/admin */}
                  {canUpload && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-sm text-gray-600 mb-2">Atualizar Nota Fiscal:</p>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.crm"
                          onChange={(e) => setNfFile(e.target.files[0])}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleUploadNF}
                          disabled={uploading || !nfFile}
                          size="sm"
                        >
                          {uploading ? 'Enviando...' : 'Atualizar'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h4 className="font-semibold text-gray-600">Nota Fiscal</h4>
                  </div>
                  {canUpload ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">Nenhuma NF anexada. Faça o upload:</p>
                      <div>
                        <Label htmlFor="nfNumeroModal" className="text-sm">Número da NF</Label>
                        <Input
                          id="nfNumeroModal"
                          type="text"
                          placeholder="Ex: 12345"
                          value={nfNumero}
                          onChange={(e) => setNfNumero(e.target.value)}
                          className="mb-2"
                        />
                      </div>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.crm"
                        onChange={(e) => setNfFile(e.target.files[0])}
                      />
                      <p className="text-xs text-gray-500"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                      <Button
                        onClick={handleUploadNF}
                        disabled={uploading || !nfFile}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Enviando...' : 'Enviar Nota Fiscal'}
                      </Button>
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Nota Fiscal ainda não disponível
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Comprovante de Pagamento do Cliente */}
              {pedido.comprovante_pagamento_url && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold">Comprovante de Pagamento (Cliente)</h4>
                      </div>
                      {pedido.comprovante_pagamento_data && (
                        <p className="text-sm text-gray-600">
                          Enviado em: {formatDateTime(pedido.comprovante_pagamento_data)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => window.open(pedido.comprovante_pagamento_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Ver Comprovante
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {/* Modal de Upload de Comprovante de Parcela */}
      {showUploadParcelaModal && (
        <Dialog open={showUploadParcelaModal} onOpenChange={setShowUploadParcelaModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Enviar Comprovante de Pagamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {parcelaSelecionada && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <div className="text-sm text-gray-600 mb-1">
                    Parcela {parcelas.findIndex(p => p.id === parcelaSelecionada.id) + 1} de {parcelas.length}
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold">R$ {parcelaSelecionada.valor?.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        Vencimento: {new Date(parcelaSelecionada.data_vencimento).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>Data do Pagamento *</Label>
                <Input
                  type="date"
                  value={dataPagamentoParcela}
                  onChange={(e) => setDataPagamentoParcela(e.target.value)}
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
                  onChange={(e) => setComprovanteParcelaFile(e.target.files[0])}
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
                    setShowUploadParcelaModal(false);
                    setComprovanteParcelaFile(null);
                    setDataPagamentoParcela('');
                    setParcelaSelecionada(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUploadComprovanteParcela}
                  disabled={!comprovanteParcelaFile || !dataPagamentoParcela || uploadingParcela}
                  className="bg-blue-600"
                >
                  {uploadingParcela ? 'Enviando...' : 'Enviar Comprovante'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}