import { useState } from 'react';
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
  Phone, Mail, CreditCard, Upload
} from 'lucide-react';
import { Pedido } from '@/api/entities';
import { User as UserEntity } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { formatDateTime } from '@/utils/exportUtils';

export default function PedidoDetailsModal({ pedido, onClose, onUpdate, currentUser, userMap, fornecedorMap }) {
  const [confirmando, setConfirmando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [boletoFile, setBoletoFile] = useState(null);
  const [nfFile, setNfFile] = useState(null);
  const [nfNumero, setNfNumero] = useState(pedido.nf_numero || '');

  // Verificar se usuário pode fazer upload (fornecedor ou admin)
  const canUpload = currentUser?.role === 'admin' || currentUser?.tipo_negocio === 'fornecedor';

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
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          if (pedido.link_rastreio) {
                            window.open(pedido.link_rastreio, '_blank');
                          } else {
                            window.open(`https://www.google.com/search?q=${encodeURIComponent(pedido.codigo_rastreio)}`, '_blank');
                          }
                        }}
                      >
                        Rastrear Pedido
                      </Button>
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

              {/* Comprovante de Pagamento do Cliente */}
              {pedido.comprovante_pagamento_url ? (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <h4 className="font-semibold text-purple-900">Comprovante de Pagamento</h4>
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
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500">
                    <FileText className="w-5 h-5" />
                    <span>Nenhum comprovante de pagamento enviado pelo cliente</span>
                  </div>
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
    </Dialog>
  );
}