import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pedido } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Save, X, Upload, Calendar } from 'lucide-react';
import { parseNFeXml } from '@/utils/nfeXml';
import { toast } from 'sonner';

export default function PedidoEditModal({ pedido, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    status: pedido.status,
    status_pagamento: pedido.status_pagamento,
    metodo_pagamento: pedido.metodo_pagamento || '',
    data_prevista_entrega: pedido.data_prevista_entrega || '',
    transportadora: pedido.transportadora || '',
    codigo_rastreio: pedido.codigo_rastreio || '',
    link_rastreio: pedido.link_rastreio || '',
    motivo_recusa: pedido.motivo_recusa || '',
    observacoes_fornecedor: pedido.observacoes_fornecedor || '',
    nf_numero: pedido.nf_numero || ''
  });
  const [nfeLida, setNfeLida] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingBoleto, setUploadingBoleto] = useState(false);

  const handleFileUpload = async (file, tipo) => {
    if (tipo === 'nf') {
      setUploadingNF(true);
    } else {
      setUploadingBoleto(true);
    }

    // XML da NF-e: numero, data de emissao e transportadora saem do proprio
    // arquivo em vez de serem digitados (ou nem registrados, como era aqui).
    let nfe = null;
    if (tipo === 'nf' && /\.xml$/i.test(file.name)) {
      try {
        nfe = parseNFeXml(await file.text());
        setNfeLida(nfe);
        setFormData(prev => ({
          ...prev,
          nf_numero: nfe.numero || prev.nf_numero,
          // Nao sobrescreve transportadora ja informada pelo fornecedor
          transportadora: prev.transportadora || nfe.transportadora || ''
        }));
      } catch (err) {
        setNfeLida(null);
        toast.warning(`Anexo enviado, mas não consegui ler o XML: ${err?.message || 'erro desconhecido'}`);
      }
    }

    try {
      const { file_url } = await UploadFile({ file });

      const updateData = {};
      if (tipo === 'nf') {
        updateData.nf_url = file_url;
        // nf_data_upload e o que define o MES DE FATURAMENTO no dashboard, nos
        // relatorios e nos filtros. Carimbar a data do upload jogava a nota no
        // mes errado toda vez que o anexo atrasava; a data da emissao manda.
        updateData.nf_data_upload = nfe?.dataEmissao
          ? nfe.dataEmissao + 'T00:00:00'
          : new Date().toISOString();
        if (nfe?.numero) updateData.nf_numero = nfe.numero;
      } else {
        updateData.boleto_url = file_url;
        updateData.boleto_data_upload = new Date().toISOString();
      }

      await Pedido.update(pedido.id, updateData);
      toast.info(`${tipo === 'nf' ? 'Nota Fiscal' : 'Boleto'} enviado com sucesso!`);
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao fazer upload do arquivo.');
    } finally {
      setUploadingNF(false);
      setUploadingBoleto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (formData.status === 'em_transporte' && (!formData.transportadora || !formData.codigo_rastreio)) {
      toast.info('Por favor, informe a transportadora e o código de rastreio.');
      return;
    }

    setSalvando(true);

    try {
      const updateData = { ...formData };

      // Postgres rejeita '' em colunas DATE: normaliza pra null
      for (const k of ['data_prevista_entrega', 'data_envio_real', 'data_entrega_real',
                       'nf_data_upload', 'boleto_data_upload', 'data_pagamento']) {
        if (updateData[k] === '') updateData[k] = null;
      }

      // Registrar data de envio
      if (formData.status === 'em_transporte' && pedido.status !== 'em_transporte') {
        updateData.data_envio_real = new Date().toISOString();
      }

      // Registrar data de entrega
      if (formData.status === 'finalizado' && pedido.status !== 'finalizado') {
        updateData.data_entrega_real = new Date().toISOString();
      }

      await Pedido.update(pedido.id, updateData);

      // Notificação de mudança de status é feita via SendEmail quando necessário

      toast.success('Pedido atualizado com sucesso!');
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao atualizar pedido. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido #{pedido.id.slice(-8).toUpperCase()}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Status do Pedido */}
          <div className="space-y-2">
            <Label htmlFor="status">Status do Pedido</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo_pedido">Novo Pedido</SelectItem>
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="em_transporte">Em Transporte</SelectItem>
                <SelectItem value="pendente_pagamento">Aguardando Pagamento</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="status_pagamento">Status do Pagamento</Label>
            <Select 
              value={formData.status_pagamento} 
              onValueChange={(value) => setFormData({ ...formData, status_pagamento: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="metodo_pagamento">Método de Pagamento</Label>
            <Select 
              value={formData.metodo_pagamento} 
              onValueChange={(value) => setFormData({ ...formData, metodo_pagamento: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="boleto_faturado">Boleto Faturado (30 dias)</SelectItem>
                <SelectItem value="transferencia">Transferência Bancária</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Prevista de Entrega */}
          {(formData.status === 'em_producao' || formData.status === 'faturado' || formData.status === 'em_transporte') && (
            <div className="space-y-2">
              <Label htmlFor="data_prevista_entrega">Data Prevista de Entrega *</Label>
              <Input
                id="data_prevista_entrega"
                type="date"
                value={formData.data_prevista_entrega}
                onChange={(e) => setFormData({ ...formData, data_prevista_entrega: e.target.value })}
              />
            </div>
          )}

          {/* Informações de Transporte */}
          {(formData.status === 'em_transporte' || formData.status === 'pendente_pagamento' || formData.status === 'finalizado') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="transportadora">Transportadora *</Label>
                <Input
                  id="transportadora"
                  value={formData.transportadora}
                  onChange={(e) => setFormData({ ...formData, transportadora: e.target.value })}
                  placeholder="Ex: Correios, Jadlog, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo_rastreio">Código de Rastreio *</Label>
                <Input
                  id="codigo_rastreio"
                  value={formData.codigo_rastreio}
                  onChange={(e) => setFormData({ ...formData, codigo_rastreio: e.target.value })}
                  placeholder="Ex: BR123456789BR"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_rastreio">Link de Rastreio</Label>
                <Input
                  id="link_rastreio"
                  value={formData.link_rastreio}
                  onChange={(e) => setFormData({ ...formData, link_rastreio: e.target.value })}
                  placeholder="Cole o link de rastreio da transportadora"
                />
                <p className="text-xs text-gray-500">
                  Link direto do site da transportadora para o cliente rastrear
                </p>
              </div>
            </>
          )}

          {/* Upload de Documentos */}
          {formData.status === 'faturado' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nota Fiscal (XML, PDF ou imagem)</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) handleFileUpload(file, 'nf');
                    }}
                    accept=".xml,.pdf,.jpg,.jpeg,.png,.crm"
                    disabled={uploadingNF}
                  />
                  {pedido.nf_url && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(pedido.nf_url, '_blank')}
                    >
                      Ver NF
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  <strong>Formatos aceitos:</strong> XML, PDF, JPG, PNG, CRM.{' '}
                  <span className="text-indigo-700 font-medium">
                    Enviando o XML, o número da NF, a data de emissão e a transportadora vêm preenchidos.
                  </span>
                </p>

                {nfeLida && (
                  <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded p-2">
                    XML lido: NF <strong>{nfeLida.numero}</strong>
                    {nfeLida.dataEmissao && <> · emitida em <strong>{nfeLida.dataEmissao.split('-').reverse().join('/')}</strong></>}
                    {nfeLida.transportadora && <> · transportadora <strong>{nfeLida.transportadora}</strong></>}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="nf_numero">Número da NF</Label>
                  <Input
                    id="nf_numero"
                    value={formData.nf_numero}
                    onChange={(e) => setFormData({ ...formData, nf_numero: e.target.value })}
                    placeholder="Preenchido pelo XML, ou digite"
                  />
                </div>
                {uploadingNF && <p className="text-sm text-blue-600">Fazendo upload...</p>}
              </div>

              <div className="space-y-2">
                <Label>Boleto</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) handleFileUpload(file, 'boleto');
                    }}
                    accept=".pdf,.jpg,.jpeg,.png,.crm"
                    disabled={uploadingBoleto}
                  />
                  {pedido.boleto_url && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(pedido.boleto_url, '_blank')}
                    >
                      Ver Boleto
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                {uploadingBoleto && <p className="text-sm text-blue-600">Fazendo upload...</p>}
              </div>
            </div>
          )}

          {/* Observações do Fornecedor */}
          <div className="space-y-2">
            <Label htmlFor="observacoes_fornecedor">Observações Internas</Label>
            <Textarea
              id="observacoes_fornecedor"
              value={formData.observacoes_fornecedor}
              onChange={(e) => setFormData({ ...formData, observacoes_fornecedor: e.target.value })}
              placeholder="Observações internas do fornecedor..."
              rows={3}
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}