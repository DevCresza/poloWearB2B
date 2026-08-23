import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Truck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Pedido, Faturamento, Carteira } from '@/api/entities';
import { UploadFile, SendEmail } from '@/api/integrations';
import { formatCurrency } from '@/utils/exportUtils';
import { parseNFeXml, casarItensNFe } from '@/utils/nfeXml';

/**
 * Faturamento (total ou parcial) de um pedido.
 *
 * Nasceu dentro de PedidosFornecedor e foi extraido daqui para o admin poder
 * faturar tambem -- ele precisa disso para corrigir faturamento que o fornecedor
 * lancou errado, e duplicar 400 linhas de regra de baixa de item era o caminho
 * curto para as duas telas divergirem.
 *
 * Todo o estado do faturamento vive aqui dentro. Na pagina do fornecedor ele
 * dividia `nfFile`/`nfNumero` com o modal "Atualizar NF", e um formulario
 * sujava o outro.
 *
 * `clientes` e usado so para achar o e-mail do comprador na notificacao; quando
 * a lista nao vem, o faturamento acontece igual e o e-mail e pulado.
 */
export default function FaturarPedidoModal({ pedido, clientes = [], onClose, onSuccess }) {
  const [itensFaturamento, setItensFaturamento] = useState([]);
  const [nfFile, setNfFile] = useState(null);
  const [nfNumero, setNfNumero] = useState('');
  const [nfDataEmissao, setNfDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPagamento, setMetodoPagamento] = useState(pedido.metodo_pagamento || '');
  const [resumoXml, setResumoXml] = useState(null);
  const [transportadoraXml, setTransportadoraXml] = useState('');
  const [uploading, setUploading] = useState(false);

  // Saldo por item = o que ainda nao foi faturado nem virou quebra.
  useEffect(() => {
    let raw = pedido.itens || [];
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (_e) { raw = []; }
    }
    setItensFaturamento(raw.map((item, idx) => ({
      ...item,
      _index: idx,
      _selected: false,
      _qtdFaturar: 0,
      _isQuebra: false,
      _qtdQuebra: 0,
      _saldo: (item.quantidade || 0) - (item.qtd_faturada || 0) - (item.qtd_quebra || 0),
    })));
  }, [pedido.id, pedido.itens]);

  // O fornecedor ja anexava o XML aqui; ate agora ele subia sem ser lido e os
  // 30+ itens do pedido eram marcados um a um. Agora o arquivo preenche numero,
  // data, transportadora e a selecao dos itens. Nada e obrigatorio: se a leitura
  // falhar, a tela continua funcionando na mao.
  const handleNfFileChange = async (file) => {
    setNfFile(file || null);
    setResumoXml(null);
    setTransportadoraXml('');
    if (!file || !/\.xml$/i.test(file.name)) return;

    try {
      const nfe = parseNFeXml(await file.text());
      if (nfe.numero) setNfNumero(nfe.numero);
      if (nfe.dataEmissao) setNfDataEmissao(nfe.dataEmissao);
      if (nfe.transportadora) setTransportadoraXml(nfe.transportadora);

      const { itens, resumo } = casarItensNFe(itensFaturamento, nfe.itens);
      setItensFaturamento(itens);
      setResumoXml({ ...resumo, numero: nfe.numero, transportadora: nfe.transportadora });

      if (resumo.casados === 0) {
        toast.warning('Li a NF, mas nenhum item casou com o pedido. Selecione na mao.');
      } else if (resumo.semCasar.length > 0) {
        toast.warning(`NF lida: ${resumo.casados} de ${resumo.totalNF} itens casados. Confira os que ficaram de fora.`);
      } else {
        toast.success(`NF ${nfe.numero} lida: ${resumo.casados} ite${resumo.casados > 1 ? 'ns' : 'm'} selecionado${resumo.casados > 1 ? 's' : ''}.`);
      }
    } catch (err) {
      console.error('Erro ao ler XML da NF:', err);
      setResumoXml({ erro: err?.message || 'Nao foi possivel ler o XML.' });
      toast.error(`Não consegui ler o XML: ${err?.message || 'erro desconhecido'}`);
    }
  };

  const handleFaturar = async () => {
    // Prevent double-clicks
    if (uploading) return;

    // Validate at least one item selected
    const itensSelecionados = itensFaturamento.filter(it => it._selected);
    if (itensSelecionados.length === 0) {
      toast.info('Selecione pelo menos um item para faturar ou marcar como quebra');
      return;
    }

    // Check if this is quebra-only (all selected items are quebra)
    const isQuebraOnly = itensSelecionados.every(it => it._isQuebra);

    // NF is required only if there are items being invoiced (not quebra-only)
    if (!isQuebraOnly && (!nfFile || !nfNumero || !nfDataEmissao)) {
      toast.info('Preencha o número, a data de emissão e envie a nota fiscal');
      return;
    }

    // Validate quantities
    for (const item of itensSelecionados) {
      if (!item._isQuebra && item._qtdFaturar <= 0) {
        toast.error(`Informe a quantidade a faturar para "${item.nome}"`);
        return;
      }
      if (item._isQuebra && item._qtdQuebra <= 0) {
        toast.error(`Informe a quantidade de quebra para "${item.nome}"`);
        return;
      }
      if (!item._isQuebra && item._qtdFaturar > item._saldo) {
        toast.error(`Quantidade a faturar excede o saldo de "${item.nome}"`);
        return;
      }
      if (item._isQuebra && item._qtdQuebra > item._saldo) {
        toast.error(`Quantidade de quebra excede o saldo de "${item.nome}"`);
        return;
      }
    }

    setUploading(true);
    try {
      // Upload NF only if not quebra-only
      let nfUpload = null;
      if (!isQuebraOnly) {
        nfUpload = await UploadFile({ file: nfFile });
      }

      // Build faturamento items (only invoiced, not quebra)
      const itensFaturados = itensSelecionados
        .filter(it => !it._isQuebra)
        .map(it => ({
          produto_id: it.produto_id || it.id,
          nome: it.nome,
          cor: it.cor_selecionada?.cor_nome || '',
          referencia: it.referencia || '',
          qtd_faturada: it._qtdFaturar,
          preco_unitario: it.preco || 0,
          total: (it._qtdFaturar) * (it.preco || 0)
        }));

      const valorFaturamento = itensFaturados.reduce((sum, it) => sum + it.total, 0);
      const valorQuebra = itensSelecionados
        .filter(it => it._isQuebra)
        .reduce((sum, it) => sum + (it._qtdQuebra * (it.preco || 0)), 0);

      // Create faturamento record (only if there are invoiced items — skip for quebra-only)
      if (itensFaturados.length > 0 && nfUpload) {
        await Faturamento.create({
          pedido_id: pedido.id,
          numero_nf: nfNumero,
          data_emissao: nfDataEmissao,
          nf_url: nfUpload.file_url,
          itens: itensFaturados,
          valor_total: valorFaturamento,
          status: 'faturado',
          transportadora: transportadoraXml || null,
          metodo_pagamento: metodoPagamento || pedido.metodo_pagamento || null
        });
      }

      // Update pedido items with qtd_faturada/qtd_quebra
      // Parse itens safely (may be string or array depending on Supabase response)
      let parsedItens = pedido.itens || [];
      if (typeof parsedItens === 'string') {
        try { parsedItens = JSON.parse(parsedItens); } catch (e) { parsedItens = []; }
      }
      const updatedItens = [...parsedItens];
      for (const item of itensSelecionados) {
        const idx = item._index;
        if (idx >= 0 && idx < updatedItens.length) {
          if (item._isQuebra) {
            updatedItens[idx] = {
              ...updatedItens[idx],
              qtd_quebra: (updatedItens[idx].qtd_quebra || 0) + item._qtdQuebra,
              status_item: ((updatedItens[idx].qtd_faturada || 0) + (updatedItens[idx].qtd_quebra || 0) + item._qtdQuebra >= updatedItens[idx].quantidade)
                ? 'quebra' : 'parcial'
            };
          } else {
            const newQtdFaturada = (updatedItens[idx].qtd_faturada || 0) + item._qtdFaturar;
            const newQtdQuebra = updatedItens[idx].qtd_quebra || 0;
            const total = updatedItens[idx].quantidade || 0;
            let statusItem = 'pendente';
            if (newQtdFaturada + newQtdQuebra >= total) {
              statusItem = newQtdQuebra > 0 ? 'faturado' : 'faturado';
            } else if (newQtdFaturada > 0) {
              statusItem = 'parcial';
            }
            updatedItens[idx] = {
              ...updatedItens[idx],
              qtd_faturada: newQtdFaturada,
              status_item: statusItem
            };
          }
        }
      }

      // Check if all items are resolved
      const todosResolvidos = updatedItens.every(it => {
        const faturado = it.qtd_faturada || 0;
        const quebra = it.qtd_quebra || 0;
        const total = it.quantidade || 0;
        return faturado + quebra >= total;
      });

      const novoValorFaturado = (pedido.valor_faturado || 0) + valorFaturamento;
      const novoValorQuebra = (pedido.valor_quebra || 0) + valorQuebra;
      const novoStatus = todosResolvidos ? 'faturado' : 'parcialmente_faturado';

      // Clean itens before saving (remove any internal _fields)
      const cleanItens = updatedItens.map(it => {
        const clean = { ...it };
        delete clean._index;
        delete clean._selected;
        delete clean._qtdFaturar;
        delete clean._isQuebra;
        delete clean._qtdQuebra;
        delete clean._saldo;
        return clean;
      });

      // Update pedido - split into two updates for reliability
      // First: update status and financial values
      const pedidoUpdate = {
        status: novoStatus,
        valor_faturado: novoValorFaturado,
        valor_quebra: novoValorQuebra,
        valor_final: (pedido.valor_total || 0) - novoValorQuebra,
      };
      // Only set NF fields if we have a NF (not quebra-only)
      if (nfUpload) {
        pedidoUpdate.nf_url = nfUpload.file_url;
        pedidoUpdate.nf_numero = nfNumero;
        pedidoUpdate.nf_data_upload = nfDataEmissao + 'T00:00:00';
      }
      // Save método de pagamento if changed
      if (metodoPagamento) {
        pedidoUpdate.metodo_pagamento = metodoPagamento;
      }
      // Transportadora lida do XML. So preenche se o pedido ainda nao tem, para
      // nao sobrescrever o que ja foi informado no "Informar Envio".
      if (transportadoraXml && !pedido.transportadora) {
        pedidoUpdate.transportadora = transportadoraXml;
      }
      await Pedido.update(pedido.id, pedidoUpdate);

      // Second: update itens JSONB separately
      try {
        await Pedido.update(pedido.id, { itens: cleanItens });
      } catch (itensErr) {
        console.warn('Erro ao atualizar itens do pedido (valores já salvos):', itensErr);
      }

      // Check if parcelas need adjustment warning
      if (valorQuebra > 0) {
        try {
          const parcelasExistentes = await Carteira.filter({ pedido_id: pedido.id });
          const parcelasReais = (parcelasExistentes || []).filter(t => t.parcela_numero);
          if (parcelasReais.length > 0) {
            toast.warning('O valor do pedido foi reduzido por quebra. As parcelas existentes podem precisar de ajuste.', { duration: 8000 });
          }
        } catch (e) {
          console.warn('Erro ao verificar parcelas:', e);
        }
      }

      // Notify client
      try {
        const cliente = clientes.find(c => c.id === pedido.comprador_user_id);
        if (cliente?.email) {
          const tipoMsg = isQuebraOnly ? 'Quebra de Produção' : (todosResolvidos ? 'Pedido Faturado' : 'Faturamento Parcial');
          const subject = isQuebraOnly
            ? `Quebra de Produção - Pedido #${pedido.id.slice(-8).toUpperCase()}`
            : `${tipoMsg} - NF #${nfNumero}`;
          await SendEmail({
            from_name: 'POLO B2B',
            to: cliente.email,
            subject,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">${tipoMsg}</h1>
                </div>
                <div style="padding: 30px; background: white;">
                  <p>Seu pedido <strong>#${pedido.id.slice(-8).toUpperCase()}</strong> foi atualizado.</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    ${!isQuebraOnly ? `<p><strong>Nota Fiscal:</strong> #${nfNumero}</p>` : ''}
                    ${valorFaturamento > 0 ? `<p><strong>Valor deste faturamento:</strong> ${formatCurrency(valorFaturamento)}</p>` : ''}
                    ${valorQuebra > 0 ? `<p style="color: #dc2626;"><strong>Quebra de produção:</strong> ${formatCurrency(valorQuebra)}</p>` : ''}
                    ${!todosResolvidos ? `<p><strong>Saldo pendente:</strong> ${formatCurrency((pedido.valor_total || 0) - novoValorFaturado - novoValorQuebra)}</p>` : ''}
                  </div>
                  ${nfUpload ? `<div style="text-align: center; margin-top: 30px;">
                    <a href="${nfUpload.file_url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">
                      Baixar Nota Fiscal
                    </a>
                  </div>` : ''}
                </div>
              </div>
            `
          });
        }
      } catch (emailError) {
        console.warn('Erro ao enviar email de faturamento:', emailError);
      }

      toast.success(isQuebraOnly ? 'Quebra registrada com sucesso!' : (todosResolvidos ? 'Pedido faturado por completo!' : 'Faturamento parcial registrado!'));
      onSuccess();
    } catch (error) {
      console.error('Erro ao faturar:', error);
      console.error('Erro detalhes:', error?.message, error?.details, error?.hint, JSON.stringify(error));
      toast.error(`Erro ao faturar pedido: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Faturar Pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Resumo do pedido */}
          {pedido && (
            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="text-sm text-gray-600">Pedido #{pedido.id.slice(-8).toUpperCase()}</p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-gray-500">Valor Total:</span>
                  <p className="font-bold">{formatCurrency(pedido.valor_total || 0)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Já Faturado:</span>
                  <p className="font-bold text-green-600">{formatCurrency(pedido.valor_faturado || 0)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Saldo Pendente:</span>
                  <p className="font-bold text-blue-600">
                    {formatCurrency((pedido.valor_total || 0) - (pedido.valor_faturado || 0) - (pedido.valor_quebra || 0))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selecionar Todos / Limpar Seleção */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = itensFaturamento.map(item => {
                  const saldo = item._saldo;
                  if (saldo <= 0) return item;
                  return { ...item, _selected: true, _qtdFaturar: saldo, _isQuebra: false, _qtdQuebra: 0 };
                });
                setItensFaturamento(updated);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Selecionar Todos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = itensFaturamento.map(item => ({
                  ...item, _selected: false, _qtdFaturar: 0, _isQuebra: false, _qtdQuebra: 0
                }));
                setItensFaturamento(updated);
              }}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Limpar Seleção
            </Button>
          </div>

          {/* Tabela de itens */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Produto</th>
                  <th className="p-2 text-center">Total</th>
                  <th className="p-2 text-center">Faturado</th>
                  <th className="p-2 text-center">Saldo</th>
                  <th className="p-2 text-center">Faturar</th>
                  <th className="p-2 text-center">Quebra</th>
                </tr>
              </thead>
              <tbody>
                {itensFaturamento.map((item, idx) => {
                  const saldo = item._saldo;
                  if (saldo <= 0) return (
                    <tr key={idx} className="border-t bg-gray-50 opacity-50">
                      <td className="p-2"></td>
                      <td className="p-2">
                        <span className="font-medium">{item.nome}</span>
                        {item.cor_selecionada?.cor_nome && <span className="text-gray-500 ml-1">({item.cor_selecionada.cor_nome})</span>}
                      </td>
                      <td className="p-2 text-center">{item.quantidade}</td>
                      <td className="p-2 text-center text-green-600">{item.qtd_faturada || 0}</td>
                      <td className="p-2 text-center">0</td>
                      <td className="p-2 text-center">-</td>
                      <td className="p-2 text-center">
                        {(item.qtd_quebra || 0) > 0 && <Badge className="bg-red-100 text-red-700 text-xs">Quebra: {item.qtd_quebra}</Badge>}
                        {!item.qtd_quebra && <span>-</span>}
                      </td>
                    </tr>
                  );
                  return (
                    <tr key={idx} className={`border-t ${item._selected ? 'bg-blue-50' : ''}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={item._selected}
                          onChange={(e) => {
                            const updated = [...itensFaturamento];
                            updated[idx] = { ...updated[idx], _selected: e.target.checked, _qtdFaturar: e.target.checked ? saldo : 0, _qtdQuebra: 0, _isQuebra: false };
                            setItensFaturamento(updated);
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="p-2">
                        <span className="font-medium">{item.nome}</span>
                        {item.cor_selecionada?.cor_nome && <span className="text-gray-500 ml-1">({item.cor_selecionada.cor_nome})</span>}
                        {item.referencia && <span className="text-gray-400 text-xs ml-1">Ref: {item.referencia}</span>}
                      </td>
                      <td className="p-2 text-center">{item.quantidade}</td>
                      <td className="p-2 text-center text-green-600">{item.qtd_faturada || 0}</td>
                      <td className="p-2 text-center font-medium">{saldo}</td>
                      <td className="p-2 text-center">
                        {item._selected && !item._isQuebra ? (
                          <Input
                            type="number"
                            min={1}
                            max={saldo}
                            value={item._qtdFaturar}
                            onChange={(e) => {
                              const updated = [...itensFaturamento];
                              updated[idx] = { ...updated[idx], _qtdFaturar: Math.min(parseInt(e.target.value) || 0, saldo) };
                              setItensFaturamento(updated);
                            }}
                            className="w-20 h-8 text-center mx-auto"
                          />
                        ) : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {item._selected ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={item._isQuebra}
                              onChange={(e) => {
                                const updated = [...itensFaturamento];
                                updated[idx] = {
                                  ...updated[idx],
                                  _isQuebra: e.target.checked,
                                  _qtdQuebra: e.target.checked ? saldo : 0,
                                  _qtdFaturar: e.target.checked ? 0 : saldo
                                };
                                setItensFaturamento(updated);
                              }}
                              className="rounded"
                            />
                            {item._isQuebra && (
                              <Input
                                type="number"
                                min={1}
                                max={saldo}
                                value={item._qtdQuebra}
                                onChange={(e) => {
                                  const updated = [...itensFaturamento];
                                  updated[idx] = { ...updated[idx], _qtdQuebra: Math.min(parseInt(e.target.value) || 0, saldo) };
                                  setItensFaturamento(updated);
                                }}
                                className="w-16 h-8 text-center"
                              />
                            )}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quebra-only alert */}
          {(() => {
            const selecionados = itensFaturamento.filter(it => it._selected);
            const isQuebraOnly = selecionados.length > 0 && selecionados.every(it => it._isQuebra);
            return isQuebraOnly ? (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Somente quebra — NF não necessária. Apenas as quantidades de quebra serão atualizadas.
                </AlertDescription>
              </Alert>
            ) : null;
          })()}

          {/* Método de Pagamento */}
          <div>
            <Label>Método de Pagamento</Label>
            <Select
              value={metodoPagamento || pedido?.metodo_pagamento || ''}
              onValueChange={(value) => setMetodoPagamento(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="a_vista">À Vista</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* NF fields — hidden when quebra-only */}
          {(() => {
            const selecionados = itensFaturamento.filter(it => it._selected);
            const isQuebraOnly = selecionados.length > 0 && selecionados.every(it => it._isQuebra);
            if (isQuebraOnly) return null;
            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nfNumero">Número da NF *</Label>
                    <Input
                      id="nfNumero"
                      value={nfNumero}
                      onChange={(e) => setNfNumero(e.target.value)}
                      placeholder="Ex: 12345"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nfDataEmissao">Data de Emissão *</Label>
                    <Input
                      id="nfDataEmissao"
                      type="date"
                      value={nfDataEmissao}
                      onChange={(e) => setNfDataEmissao(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="nfFile">Upload da Nota Fiscal *</Label>
                  <Input
                    id="nfFile"
                    type="file"
                    accept=".xml,.pdf,.jpg,.jpeg,.png,.crm"
                    onChange={(e) => handleNfFileChange(e.target.files[0])}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Formatos aceitos:</strong> XML, PDF, JPG, PNG, CRM.{' '}
                    <span className="text-indigo-700 font-medium">
                      Enviando o XML, o número, a data, a transportadora e os itens são preenchidos sozinhos.
                    </span>
                  </p>
                </div>

                {/* Resultado da leitura do XML */}
                {resumoXml && (
                  resumoXml.erro ? (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <strong>Não consegui ler o XML.</strong> {resumoXml.erro}
                        <br />
                        O arquivo continua anexado — preencha os campos e marque os itens na mão.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 space-y-2 text-sm">
                      <p className="font-semibold text-indigo-900">
                        NF {resumoXml.numero} lida — {resumoXml.casados} de {resumoXml.totalNF} iten(s) casados com o pedido
                      </p>

                      {resumoXml.transportadora && (
                        <p className="text-indigo-800">
                          <Truck className="w-4 h-4 inline mr-1" />
                          Transportadora: <strong>{resumoXml.transportadora}</strong>
                          <span className="text-indigo-600"> (usada no Informar Envio)</span>
                        </p>
                      )}

                      {resumoXml.semCasar?.length > 0 && (
                        <div className="text-amber-900">
                          <p className="font-medium">Itens da NF que ficaram de fora — marque na mão se for o caso:</p>
                          <ul className="list-disc ml-5">
                            {resumoXml.semCasar.map((s, i) => (
                              <li key={i}>{s.linha.xProd || s.linha.cProd} — {s.motivo}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {resumoXml.alertas?.length > 0 && (
                        <div className="text-amber-900">
                          <p className="font-medium">Confira antes de confirmar:</p>
                          <ul className="list-disc ml-5">
                            {resumoXml.alertas.map((a, i) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}

                      {resumoXml.naoCobertos?.length > 0 && (
                        <p className="text-gray-700">
                          Fora da NF (seguem em aberto): {resumoXml.naoCobertos.join(', ')}
                        </p>
                      )}
                    </div>
                  )
                )}
              </>
            );
          })()}

          {/* Real-time summary */}
          {pedido && (() => {
            const selecionados = itensFaturamento.filter(it => it._selected);
            const valorFat = selecionados.filter(it => !it._isQuebra).reduce((s, it) => s + (it._qtdFaturar * (it.preco || 0)), 0);
            const valorQuebra = selecionados.filter(it => it._isQuebra).reduce((s, it) => s + (it._qtdQuebra * (it.preco || 0)), 0);
            const saldoApos = (pedido.valor_total || 0) - (pedido.valor_faturado || 0) - (pedido.valor_quebra || 0) - valorFat - valorQuebra;
            return (
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-indigo-900 mb-2">Resumo deste faturamento</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Valor a faturar:</span>
                    <p className="font-bold text-green-600">{formatCurrency(valorFat)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor da quebra:</span>
                    <p className="font-bold text-red-600">{formatCurrency(valorQuebra)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Saldo restante após:</span>
                    <p className="font-bold text-blue-600">{formatCurrency(Math.max(0, saldoApos))}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onClose()}>
              Cancelar
            </Button>
            <Button
              onClick={handleFaturar}
              disabled={uploading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {uploading ? 'Processando...' : 'Faturar Selecionados'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
