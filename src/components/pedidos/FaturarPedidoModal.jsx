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
import { conferirDivisao, ehBoleto, rotuloMetodo, METODOS } from '@/utils/divisaoPagamento';

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
  // Lista: o fornecedor pode emitir mais de uma nota para a MESMA remessa
  // (CFOP diferente, nota complementar, limite do emissor).
  const [nfFiles, setNfFiles] = useState([]);
  const [nfNumero, setNfNumero] = useState('');
  const [nfDataEmissao, setNfDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  // Divisao do pagamento desta nota. Uma linha = uma forma. O cliente que
  // paga metade a vista e metade no credito tem duas linhas aqui -- antes
  // era um select unico e nao havia como registrar isso.
  const [pagamentos, setPagamentos] = useState([
    { metodo: pedido.metodo_pagamento || 'boleto_faturado', valor: '' }
  ]);
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
  const handleNfFilesChange = async (fileList) => {
    const arquivos = Array.from(fileList || []);
    setNfFiles(arquivos);
    setResumoXml(null);
    setTransportadoraXml('');

    // Varias notas, um so casamento de itens: le o primeiro XML da selecao. Os
    // demais sao anexados sem releitura -- casar item duas vezes marcaria a
    // mesma linha duas vezes e dobraria a baixa.
    const xml = arquivos.find(f => /\.xml$/i.test(f.name));
    if (!xml) return;

    try {
      const nfe = parseNFeXml(await xml.text());
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

      if (arquivos.length > 1) {
        toast.info(`${arquivos.length} arquivos anexados. Os itens vieram do XML "${xml.name}".`);
      }
    } catch (err) {
      console.error('Erro ao ler XML da NF:', err);
      setResumoXml({ erro: err?.message || 'Nao foi possivel ler o XML.' });
      toast.error(`Não consegui ler o XML: ${err?.message || 'erro desconhecido'}`);
    }
  };

  // Valor que este faturamento vai gerar -- a divisao tem que fechar com ele.
  const valorAFaturar = itensFaturamento
    .filter(it => it._selected && !it._isQuebra)
    .reduce((s2, it) => s2 + (it._qtdFaturar * (it.preco || 0)), 0);

  const divisaoPagamento = conferirDivisao(pagamentos, valorAFaturar);

  const alterarPagamento = (i, campo, valor) => {
    setPagamentos(prev => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  };

  // A nova linha ja nasce com o que falta para fechar: dividir R$ 17.277,12 em
  // duas partes nao deveria obrigar ninguem a calcular a metade na mao.
  const adicionarPagamento = () => {
    const jaSomado = pagamentos.reduce((s2, l) => s2 + (parseFloat(String(l.valor).replace(',', '.')) || 0), 0);
    const restante = Math.max(0, valorAFaturar - jaSomado);
    const usados = new Set(pagamentos.map(l => l.metodo));
    const livre = METODOS.find(m => !usados.has(m.valor))?.valor || '';
    setPagamentos(prev => [...prev, { metodo: livre, valor: restante > 0 ? restante.toFixed(2) : '' }]);
  };

  const removerPagamento = (i) => {
    setPagamentos(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
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
    if (!isQuebraOnly && (nfFiles.length === 0 || !nfNumero || !nfDataEmissao)) {
      toast.info('Preencha o número, a data de emissão e envie a nota fiscal');
      return;
    }

    // Quebra pura nao gera cobranca, entao nao precisa de divisao.
    if (!isQuebraOnly && divisaoPagamento.erro) {
      toast.error(divisaoPagamento.erro);
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
      // Upload das notas (quebra pura nao tem nota).
      // nfArquivos guarda todas; nfUrlPrincipal espelha a primeira, que e o que
      // as telas do cliente e o e-mail ja leem de nf_url.
      const nfArquivos = [];
      if (!isQuebraOnly) {
        for (const arquivo of nfFiles) {
          const enviado = await UploadFile({ file: arquivo });
          nfArquivos.push({ url: enviado.file_url, nome: arquivo.name });
        }
      }
      const nfUrlPrincipal = nfArquivos[0]?.url || null;

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
      if (itensFaturados.length > 0 && nfUrlPrincipal) {
        const faturamentoCriado = await Faturamento.create({
          pedido_id: pedido.id,
          numero_nf: nfNumero,
          data_emissao: nfDataEmissao,
          nf_url: nfUrlPrincipal,
          nf_arquivos: nfArquivos,
          itens: itensFaturados,
          valor_total: valorFaturamento,
          status: 'faturado',
          transportadora: transportadoraXml || null,
          pagamentos: divisaoPagamento.linhas,
          // metodo_pagamento espelha a PRIMEIRA forma: relatorios, exports e o
          // PDF do pedido leem essa coluna e nao devem quebrar com a divisao.
          metodo_pagamento: divisaoPagamento.linhas[0]?.metodo || pedido.metodo_pagamento || null
        });

        // Partes que NAO sao boleto viram titulo agora: elas nao tem boleto
        // para anexar depois, entao se nao nascerem aqui nunca nascem -- e o
        // em-aberto do cliente ficaria menor que a nota, parecendo cobranca
        // faltando. A parte em boleto fica para o fluxo de boleto, que precisa
        // do PDF e das datas de vencimento.
        const semBoleto = divisaoPagamento.linhas.filter(l => !ehBoleto(l.metodo));
        if (faturamentoCriado?.id && semBoleto.length > 0) {
          for (let i = 0; i < semBoleto.length; i++) {
            const linha = semBoleto[i];
            await Carteira.create({
              pedido_id: pedido.id,
              faturamento_id: faturamentoCriado.id,
              tipo: 'a_receber',
              status: 'pendente',
              valor: linha.valor,
              // Sem data de vencimento de proposito. total_vencido conta
              // 'pendente' COM data_vencimento < hoje; com a data da emissao,
              // toda venda a vista viraria "vencida" no dia seguinte e o
              // cliente apareceria inadimplente sem dever nada. Sem data, o
              // titulo entra no em-aberto (que e verdade: ainda nao teve
              // baixa) e nunca no vencido.
              data_vencimento: null,
              // Numeracao alta e propria: o indice unico
              // (faturamento_id, parcela_numero) nao aceita repetido, e estes
              // titulos nao podem colidir com as parcelas 1..N do boleto.
              parcela_numero: 900 + i,
              total_parcelas: semBoleto.length,
              metodo_pagamento: linha.metodo,
              descricao: `${rotuloMetodo(linha.metodo)} - NF #${nfNumero}`,
              loja_id: pedido.loja_id || null,
              cliente_user_id: pedido.comprador_user_id || null,
              fornecedor_id: pedido.fornecedor_id || null
            });
          }
        }
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
      if (nfUrlPrincipal) {
        pedidoUpdate.nf_url = nfUrlPrincipal;
        pedidoUpdate.nf_numero = nfNumero;
        pedidoUpdate.nf_data_upload = nfDataEmissao + 'T00:00:00';
      }
      // Save método de pagamento if changed
      if (divisaoPagamento.linhas[0]?.metodo) {
        pedidoUpdate.metodo_pagamento = divisaoPagamento.linhas[0].metodo;
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
                  ${nfArquivos.length > 0 ? `<div style="text-align: center; margin-top: 30px;">
                    ${nfArquivos.map((a, i) => `<a href="${a.url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 4px;">
                      ${nfArquivos.length > 1 ? `Baixar Nota ${i + 1}` : 'Baixar Nota Fiscal'}
                    </a>`).join('')}
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

          {/* Formas de pagamento desta nota. Era um select unico: o cliente que
              paga metade a vista e metade no credito nao tinha como registrar. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Formas de Pagamento</Label>
              <span className="text-xs text-gray-600">
                Valor a faturar: <strong>{formatCurrency(valorAFaturar)}</strong>
              </span>
            </div>

            {pagamentos.map((linha, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={linha.metodo}
                  onValueChange={(v) => alterarPagamento(i, 'metodo', v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione a forma" />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS.map(m => (
                      <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-600">R$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={pagamentos.length === 1 ? formatCurrency(valorAFaturar).replace('R$', '').trim() : '0,00'}
                    value={linha.valor}
                    onChange={(e) => alterarPagamento(i, 'valor', e.target.value)}
                    className="w-32"
                  />
                </div>
                {pagamentos.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removerPagamento(i)} title="Remover forma">
                    <XCircle className="w-4 h-4 text-gray-400" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={adicionarPagamento}
                disabled={pagamentos.length >= METODOS.length}
              >
                + Dividir em outra forma
              </Button>

              {valorAFaturar > 0 && (
                divisaoPagamento.erro ? (
                  <span className="text-xs text-red-700 font-medium">{divisaoPagamento.erro}</span>
                ) : pagamentos.length > 1 ? (
                  <span className="text-xs text-green-700">
                    {divisaoPagamento.linhas.map(l => `${rotuloMetodo(l.metodo)} ${formatCurrency(l.valor)}`).join('  +  ')}
                  </span>
                ) : null
              )}
            </div>

            {divisaoPagamento.valorBoleto > 0 && divisaoPagamento.valorAVista > 0 && !divisaoPagamento.erro && (
              <p className="text-xs text-gray-600">
                A parte em boleto ({formatCurrency(divisaoPagamento.valorBoleto)}) é cobrada no envio do boleto,
                com as datas de vencimento. O resto vira título na carteira agora.
              </p>
            )}
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
                  <Label htmlFor="nfFile">Upload da(s) Nota(s) Fiscal(is) *</Label>
                  <Input
                    id="nfFile"
                    type="file"
                    accept=".xml,.pdf,.jpg,.jpeg,.png,.crm"
                    multiple
                    onChange={(e) => handleNfFilesChange(e.target.files)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Formatos aceitos:</strong> XML, PDF, JPG, PNG, CRM.{' '}
                    <span className="text-indigo-700 font-medium">
                      Enviando o XML, o número, a data, a transportadora e os itens são preenchidos sozinhos.
                    </span>{' '}
                    Pode selecionar mais de uma nota para esta mesma remessa.
                  </p>

                  {nfFiles.length > 0 && (
                    <ul className="mt-2 text-xs text-gray-700 space-y-1">
                      {nfFiles.map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-gray-400 shrink-0">{i + 1}.</span>
                          <span className="truncate">{f.name}</span>
                          {i === 0 && nfFiles.length > 1 && (
                            <span className="text-gray-400 shrink-0">(principal)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
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
              // Divisao que nao fecha com o valor da nota nao passa daqui: o
              // handler tambem recusa, mas deixar o botao ativo convida a
              // clicar e so entao descobrir. Quebra pura nao tem cobranca.
              disabled={uploading || (valorAFaturar > 0 && !!divisaoPagamento.erro)}
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
