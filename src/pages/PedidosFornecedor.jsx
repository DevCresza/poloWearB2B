
import { useState, useEffect } from 'react';
import { Pedido } from '@/api/entities';
import { toast } from 'sonner';
import { Produto } from '@/api/entities'; // Not used in this file, but kept from original imports
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Fornecedor } from '@/api/entities'; // Added import for Fornecedor
import { Faturamento } from '@/api/entities';
import { SendEmail, UploadFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Not used, but kept from original imports
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Package, Clock, CheckCircle, XCircle, Calendar, DollarSign,
  FileText, Upload, Download, Filter, Eye, Edit, Truck, AlertTriangle, BarChart3
} from 'lucide-react';
import PedidoDetailsModal from '@/components/pedidos/PedidoDetailsModal';
import { formatCurrency, exportToPDF, exportToCSV, formatDate } from '@/utils/exportUtils';
import { Loja } from '@/api/entities';
import { Store } from 'lucide-react';

export default function PedidosFornecedor() {
  const [user, setUser] = useState(null);
  const [fornecedorAtual, setFornecedorAtual] = useState(null); // Fornecedor do usuário logado
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [lojasMap, setLojasMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroEmissaoDe, setFiltroEmissaoDe] = useState('');
  const [filtroEmissaoAte, setFiltroEmissaoAte] = useState('');
  const [filtroFaturamentoDe, setFiltroFaturamentoDe] = useState('');
  const [filtroFaturamentoAte, setFiltroFaturamentoAte] = useState('');
  const [selectedPedido, setSelectedPedido] = useState(null);
  
  // Modais
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFaturarModal, setShowFaturarModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsDefaultTab, setDetailsDefaultTab] = useState('itens');
  const [showBoletoModal, setShowBoletoModal] = useState(false);
  const [showBoletoNFModal, setShowBoletoNFModal] = useState(false);
  const [boletoNFList, setBoletoNFList] = useState([]);
  const [boletoNFSelected, setBoletoNFSelected] = useState(null);
  const [boletoNFFile, setBoletoNFFile] = useState(null);
  const [boletoNFQtdParcelas, setBoletoNFQtdParcelas] = useState(1);
  const [boletoNFParcelas, setBoletoNFParcelas] = useState([{ dataVencimento: '' }]);
  const [boletoNFUploading, setBoletoNFUploading] = useState(false);
  const [boletoNFLoading, setBoletoNFLoading] = useState(false);
  const [showAtualizarNFModal, setShowAtualizarNFModal] = useState(false);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  
  // Forms
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [nfFile, setNfFile] = useState(null);
  const [boletoFile, setBoletoFile] = useState(null);
  const [nfNumero, setNfNumero] = useState('');
  const [nfDataEmissao, setNfDataEmissao] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [linkRastreio, setLinkRastreio] = useState('');
  const [dataEnvio, setDataEnvio] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [valorFreteFOB, setValorFreteFOB] = useState('');
  const [tipoFrete, setTipoFrete] = useState('CIF');
  const [freteInclusoBoleto, setFreteInclusoBoleto] = useState(false);
  const [freteModoCobr, setFreteModoCobr] = useState('diluido');

  // Faturamento parcial
  const [itensFaturamento, setItensFaturamento] = useState([]);

  // Estados para parcelas do boleto
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [parcelas, setParcelas] = useState([{ dataVencimento: '', boletoFile: null }]);
  const [boletoUnico, setBoletoUnico] = useState(false);
  const [boletoUnicoFile, setBoletoUnicoFile] = useState(null);

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
        pedidosList = await Pedido.list({ sort: '-created_date' });
        clientesList = await User.list(); // Load all users for admin
      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Usar fornecedor_id do usuário diretamente (se disponível)
        // ou buscar fornecedor pelo responsavel_user_id (fallback para usuários antigos)
        let fornecedorId = currentUser.fornecedor_id;
        let fornecedor = null;

        if (fornecedorId) {
          // Buscar dados do fornecedor pelo ID
          fornecedor = await Fornecedor.get(fornecedorId);
        } else {
          // Fallback: buscar fornecedor pelo responsavel_user_id
          const fornecedoresList = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
          fornecedor = fornecedoresList[0];
          if (fornecedor) {
            fornecedorId = fornecedor.id;
          }
        }

        if (fornecedor) {
          setFornecedorAtual(fornecedor);
          pedidosList = await Pedido.filter({ fornecedor_id: fornecedorId }, '-created_date');

          // Buscar todos os clientes para evitar problemas de "não encontrado"
          const todosClientes = await User.list();
          const clienteIds = [...new Set(pedidosList.map(p => p.comprador_user_id))];
          clientesList = todosClientes.filter(u => clienteIds.includes(u.id));

          // Debug: logs para identificar problema
          console.log('📋 Total de pedidos carregados:', pedidosList.length);
          console.log('👥 IDs de compradores únicos:', clienteIds);
          console.log('👥 Total de usuários no sistema:', todosClientes.length);
          console.log('✅ Clientes filtrados encontrados:', clientesList.length);

          // Verificar quais IDs não foram encontrados
          const clientesNaoEncontrados = clienteIds.filter(id => !clientesList.find(c => c.id === id));
          if (clientesNaoEncontrados.length > 0) {
            console.warn('⚠️ IDs de clientes não encontrados:', clientesNaoEncontrados);
          }
        }
      }

      setPedidos(pedidosList || []);
      setClientes(clientesList || []);

      const [fornecedoresList, lojasList] = await Promise.all([
        Fornecedor.list(),
        Loja.list()
      ]);
      setFornecedores(fornecedoresList);

      // Build lojas map
      const map = {};
      (lojasList || []).forEach(l => { map[l.id] = l; });
      setLojasMap(map);
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
      toast.info('Informe a data prevista de entrega');
      return;
    }

    try {
      await Pedido.update(selectedPedido.id, {
        status: 'em_producao',
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
              <p>Valor total: ${formatCurrency(selectedPedido.valor_total)}</p>
              <p style="margin-top: 30px;">Acompanhe o status do seu pedido no sistema.</p>
            </div>
          </div>
        `
      });

      toast.success('Pedido aprovado com sucesso!');
      setShowApprovalModal(false);
      setDataEntrega('');
      loadPedidos(); // Changed from loadData
    } catch (error) {
      toast.error('Erro ao aprovar pedido');
    }
  };

  const handleRecusar = async () => {
    if (!motivoRecusa) {
      toast.info('Informe o motivo da recusa');
      return;
    }

    try {
      await Pedido.update(selectedPedido.id, {
        status: 'cancelado',
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

      toast.info('Pedido recusado');
      setShowRejectModal(false);
      setMotivoRecusa('');
      loadPedidos(); // Changed from loadData
    } catch (error) {
      toast.error('Erro ao recusar pedido');
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
          pedido_id: selectedPedido.id,
          numero_nf: nfNumero,
          data_emissao: nfDataEmissao,
          nf_url: nfUpload.file_url,
          itens: itensFaturados,
          valor_total: valorFaturamento,
          status: 'faturado',
          metodo_pagamento: metodoPagamento || selectedPedido.metodo_pagamento || null
        });
      }

      // Update pedido items with qtd_faturada/qtd_quebra
      // Parse itens safely (may be string or array depending on Supabase response)
      let parsedItens = selectedPedido.itens || [];
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

      const novoValorFaturado = (selectedPedido.valor_faturado || 0) + valorFaturamento;
      const novoValorQuebra = (selectedPedido.valor_quebra || 0) + valorQuebra;
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
        valor_final: (selectedPedido.valor_total || 0) - novoValorQuebra,
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
      await Pedido.update(selectedPedido.id, pedidoUpdate);

      // Second: update itens JSONB separately
      try {
        await Pedido.update(selectedPedido.id, { itens: cleanItens });
      } catch (itensErr) {
        console.warn('Erro ao atualizar itens do pedido (valores já salvos):', itensErr);
      }

      // Check if parcelas need adjustment warning
      if (valorQuebra > 0) {
        try {
          const parcelasExistentes = await Carteira.filter({ pedido_id: selectedPedido.id });
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
        const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
        if (cliente?.email) {
          const tipoMsg = isQuebraOnly ? 'Quebra de Produção' : (todosResolvidos ? 'Pedido Faturado' : 'Faturamento Parcial');
          const subject = isQuebraOnly
            ? `Quebra de Produção - Pedido #${selectedPedido.id.slice(-8).toUpperCase()}`
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
                  <p>Seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi atualizado.</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    ${!isQuebraOnly ? `<p><strong>Nota Fiscal:</strong> #${nfNumero}</p>` : ''}
                    ${valorFaturamento > 0 ? `<p><strong>Valor deste faturamento:</strong> ${formatCurrency(valorFaturamento)}</p>` : ''}
                    ${valorQuebra > 0 ? `<p style="color: #dc2626;"><strong>Quebra de produção:</strong> ${formatCurrency(valorQuebra)}</p>` : ''}
                    ${!todosResolvidos ? `<p><strong>Saldo pendente:</strong> ${formatCurrency((selectedPedido.valor_total || 0) - novoValorFaturado - novoValorQuebra)}</p>` : ''}
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
      setShowFaturarModal(false);
      resetFaturarForm();
      loadPedidos();
    } catch (error) {
      console.error('Erro ao faturar:', error);
      console.error('Erro detalhes:', error?.message, error?.details, error?.hint, JSON.stringify(error));
      toast.error(`Erro ao faturar pedido: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEnviar = async () => {
    if (!transportadora || !dataEnvio) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const valorFrete = parseFloat(valorFreteFOB) || 0;

    if (tipoFrete === 'FOB' && valorFrete <= 0) {
      toast.error('Informe o valor do frete FOB');
      return;
    }

    try {
      // Calcular valor_final com base no tipo de frete
      const valorProdutos = selectedPedido.valor_total || 0;
      let valorFinal = selectedPedido.valor_final || valorProdutos;

      if (tipoFrete === 'FOB') {
        if (freteInclusoBoleto) {
          // FOB + incluir no boleto: valor_final = produtos + frete
          valorFinal = valorProdutos + valorFrete;
        } else {
          // FOB + separado: valor_final fica só os produtos
          valorFinal = valorProdutos;
        }
      }
      // CIF: valor_final não muda (frete por conta do fornecedor)

      const updateData = {
        status: 'em_transporte',
        transportadora,
        codigo_rastreio: codigoRastreio,
        link_rastreio: linkRastreio || null,
        data_envio_real: dataEnvio,
        tipo_frete: tipoFrete,
        valor_frete_fob: tipoFrete === 'FOB' ? valorFrete : 0,
        frete_incluso_boleto: tipoFrete === 'FOB' ? freteInclusoBoleto : false,
        frete_modo_cobranca: tipoFrete === 'FOB' && freteInclusoBoleto ? freteModoCobr : null,
        valor_final: valorFinal
      };

      await Pedido.update(selectedPedido.id, updateData);

      // Se FOB + incluir no boleto e já existem parcelas, recalcular
      if (tipoFrete === 'FOB' && freteInclusoBoleto && valorFrete > 0) {
        try {
          const parcelasExistentes = await Carteira.filter({ pedido_id: selectedPedido.id });
          const parcelasReais = (parcelasExistentes || []).filter(t => t.parcela_numero);

          if (parcelasReais.length > 0) {
            const totalParcelas = parcelasReais.length;

            // Deletar parcelas existentes
            for (const parcela of parcelasExistentes) {
              await Carteira.delete(parcela.id);
            }

            // Recriar com novo valor, respeitando frete_modo_cobranca
            if (freteModoCobr === 'primeiro_boleto' && totalParcelas > 1) {
              const valorProdutosParcela = valorProdutos / totalParcelas;
              for (let i = 0; i < totalParcelas; i++) {
                const valor = i === 0 ? valorProdutosParcela + valorFrete : valorProdutosParcela;
                await Carteira.create({
                  pedido_id: selectedPedido.id,
                  cliente_user_id: selectedPedido.comprador_user_id,
                  fornecedor_id: selectedPedido.fornecedor_id,
                  loja_id: selectedPedido.loja_id,
                  tipo: 'a_receber',
                  valor: valor,
                  data_vencimento: parcelasReais[i]?.data_vencimento,
                  status: 'pendente',
                  parcela_numero: i + 1,
                  total_parcelas: totalParcelas,
                  boleto_url: parcelasReais[i]?.boleto_url,
                  descricao: totalParcelas > 1 ? `Parcela ${i + 1}/${totalParcelas} - Pedido #${selectedPedido.id.slice(-8).toUpperCase()}` : `Pedido #${selectedPedido.id.slice(-8).toUpperCase()}`
                });
              }
            } else {
              // Diluído: valor_final / totalParcelas
              const valorParcela = valorFinal / totalParcelas;
              for (let i = 0; i < totalParcelas; i++) {
                await Carteira.create({
                  pedido_id: selectedPedido.id,
                  cliente_user_id: selectedPedido.comprador_user_id,
                  fornecedor_id: selectedPedido.fornecedor_id,
                  loja_id: selectedPedido.loja_id,
                  tipo: 'a_receber',
                  valor: valorParcela,
                  data_vencimento: parcelasReais[i]?.data_vencimento,
                  status: 'pendente',
                  parcela_numero: i + 1,
                  total_parcelas: totalParcelas,
                  boleto_url: parcelasReais[i]?.boleto_url,
                  descricao: totalParcelas > 1 ? `Parcela ${i + 1}/${totalParcelas} - Pedido #${selectedPedido.id.slice(-8).toUpperCase()}` : `Pedido #${selectedPedido.id.slice(-8).toUpperCase()}`
                });
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao recalcular parcelas com frete:', e);
        }
      }

      // Notificar cliente (não bloquear o fluxo se o email falhar)
      try {
        const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
        if (cliente?.email) {
          const freteEmailHtml = tipoFrete === 'FOB' ? `
                    <p><strong>Tipo de Frete:</strong> FOB (por conta do cliente)</p>
                    <p><strong>Valor do Frete:</strong> R$ ${valorFrete.toFixed(2).replace('.', ',')}</p>
                    ${freteInclusoBoleto ? '<p><em>Frete incluso no boleto</em></p>' : '<p><em>Frete cobrado separadamente</em></p>'}
          ` : `<p><strong>Tipo de Frete:</strong> CIF (por conta do fornecedor)</p>`;

          await SendEmail({
            from_name: 'POLO B2B',
            to: cliente.email,
            subject: `Pedido Enviado - #${selectedPedido.id.slice(-8).toUpperCase()}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Pedido em Transporte</h1>
                </div>
                <div style="padding: 30px; background: white;">
                  <p>Seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi enviado!</p>
                  <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Transportadora:</strong> ${transportadora}</p>
                    ${codigoRastreio ? `<p><strong>Codigo de Rastreio:</strong> ${codigoRastreio}</p>` : ''}
                    <p><strong>Data de Envio:</strong> ${new Date(dataEnvio + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    ${freteEmailHtml}
                  </div>
                  <p>Acompanhe seu pedido no sistema!</p>
                </div>
              </div>
            `
          });
        }
      } catch (emailError) {
        console.warn('Erro ao enviar email de notificação de envio:', emailError);
      }

      toast.info('Informacoes de envio salvas!');
      setShowEnvioModal(false);
      resetEnvioForm();
      loadPedidos();
    } catch (error) {
      toast.error('Erro ao atualizar informacoes de envio');
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

      toast.info('Método de pagamento alterado!');
      loadPedidos(); // Changed from loadData
    } catch (error) {
      toast.error('Erro ao alterar método de pagamento');
    }
  };

  // Handler para enviar boleto separadamente
  const handleEnviarBoleto = async () => {
    if (!boletoFile) {
      toast.info('Selecione o arquivo do boleto');
      return;
    }

    // Validar datas de vencimento das parcelas
    const datasInvalidas = parcelas.some(p => !p.dataVencimento);
    if (datasInvalidas) {
      toast.info('Informe a data de vencimento de todas as parcelas');
      return;
    }

    setUploading(true);
    try {
      const boletoUpload = await UploadFile({ file: boletoFile });

      // Atualizar pedido com boleto e info de parcelas
      // Resetar confirmação de boleto do cliente ao atualizar
      await Pedido.update(selectedPedido.id, {
        boleto_url: boletoUpload.file_url,
        boleto_data_upload: new Date().toISOString(),
        qtd_parcelas: qtdParcelas,
        cliente_confirmou_boleto: false,
        status_pagamento: 'pendente',
        parcelas_info: parcelas.map((p, i) => ({
          numero: i + 1,
          dataVencimento: p.dataVencimento,
          boletoUrl: boletoUpload.file_url
        }))
      });

      // Excluir TODAS as cobranças existentes do pedido (placeholders e parcelas reais)
      // Ao atualizar boleto, todas as parcelas anteriores são substituídas pelas novas
      try {
        const todasEntradas = await Carteira.filter({ pedido_id: selectedPedido.id });
        for (const entrada of (todasEntradas || [])) {
          await Carteira.delete(entrada.id);
        }
      } catch (e) {
        console.warn('Erro ao limpar cobranças anteriores:', e);
      }

      // Criar títulos na carteira financeira para cada parcela
      // Usar valor_final se disponível (inclui frete FOB), caso contrário usar valor_total
      const valorBase = selectedPedido.valor_final || selectedPedido.valor_total;
      const frete = parseFloat(selectedPedido.valor_frete_fob) || 0;
      const freteNoBoleto = selectedPedido.frete_incluso_boleto && frete > 0;

      if (freteNoBoleto && selectedPedido.frete_modo_cobranca === 'primeiro_boleto' && qtdParcelas > 1) {
        // Valor dos produtos dividido igualmente, frete todo na primeira parcela
        const valorProdutosParcela = (selectedPedido.valor_total || 0) / qtdParcelas;
        for (let i = 0; i < qtdParcelas; i++) {
          const valor = i === 0 ? valorProdutosParcela + frete : valorProdutosParcela;
          await Carteira.create({
            pedido_id: selectedPedido.id,
            cliente_user_id: selectedPedido.comprador_user_id,
            fornecedor_id: selectedPedido.fornecedor_id,
            loja_id: selectedPedido.loja_id,
            tipo: 'a_receber',
            valor: valor,
            data_vencimento: parcelas[i].dataVencimento,
            status: 'pendente',
            parcela_numero: i + 1,
            total_parcelas: qtdParcelas,
            boleto_url: boletoUpload.file_url,
            descricao: qtdParcelas > 1 ? `Parcela ${i + 1}/${qtdParcelas} - Pedido #${selectedPedido.id.slice(-8).toUpperCase()}` : `Pedido #${selectedPedido.id.slice(-8).toUpperCase()}`
          });
        }
      } else {
        // Fluxo normal: valor_final já inclui frete se diluído
        const valorParcela = valorBase / qtdParcelas;
        for (let i = 0; i < qtdParcelas; i++) {
          await Carteira.create({
            pedido_id: selectedPedido.id,
            cliente_user_id: selectedPedido.comprador_user_id,
            fornecedor_id: selectedPedido.fornecedor_id,
            loja_id: selectedPedido.loja_id,
            tipo: 'a_receber',
            valor: valorParcela,
            data_vencimento: parcelas[i].dataVencimento,
            status: 'pendente',
            parcela_numero: i + 1,
            total_parcelas: qtdParcelas,
            boleto_url: boletoUpload.file_url,
            descricao: qtdParcelas > 1 ? `Parcela ${i + 1}/${qtdParcelas} - Pedido #${selectedPedido.id.slice(-8).toUpperCase()}` : `Pedido #${selectedPedido.id.slice(-8).toUpperCase()}`
          });
        }
      }

      // Montar lista de parcelas para o email
      // Calcular valor individual de cada parcela para o email
      const getValorParcelaEmail = (index) => {
        if (freteNoBoleto && selectedPedido.frete_modo_cobranca === 'primeiro_boleto' && qtdParcelas > 1) {
          const valorProdutosParcela = (selectedPedido.valor_total || 0) / qtdParcelas;
          return index === 0 ? valorProdutosParcela + frete : valorProdutosParcela;
        }
        return valorBase / qtdParcelas;
      };

      const parcelasHtml = parcelas.map((p, i) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${i + 1}/${qtdParcelas}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatCurrency(getValorParcelaEmail(i))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(p.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
        </tr>
      `).join('');

      // Notificar cliente
      const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
      const temFrete = selectedPedido.valor_frete_fob && selectedPedido.valor_frete_fob > 0;
      await SendEmail({
        from_name: 'POLO B2B',
        to: cliente?.email,
        subject: `📄 Boleto Disponível - Pedido #${selectedPedido.id.slice(-8).toUpperCase()}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">📄 Boleto Disponível</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>O boleto do seu pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> está disponível!</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${temFrete ? `
                  <p><strong>Valor dos Produtos:</strong> ${formatCurrency(selectedPedido.valor_total)}</p>
                  <p><strong>Frete FOB:</strong> ${formatCurrency(selectedPedido.valor_frete_fob)}</p>
                ` : ''}
                <p><strong>Valor Total:</strong> ${formatCurrency(valorBase)}</p>
                ${qtdParcelas > 1 ? `<p><strong>Parcelado em:</strong> ${qtdParcelas}x de ${formatCurrency(valorBase / qtdParcelas)}</p>` : ''}
              </div>

              ${qtdParcelas > 0 ? `
                <h3 style="margin-top: 20px;">📅 Parcelas e Vencimentos</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  <thead>
                    <tr style="background: #f3f4f6;">
                      <th style="padding: 8px; text-align: left;">Parcela</th>
                      <th style="padding: 8px; text-align: left;">Valor</th>
                      <th style="padding: 8px; text-align: left;">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${parcelasHtml}
                  </tbody>
                </table>
              ` : ''}

              <div style="text-align: center; margin-top: 30px;">
                <a href="${boletoUpload.file_url}" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">
                  Baixar Boleto
                </a>
              </div>
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                Você receberá um lembrete por e-mail no vencimento de cada parcela.
              </p>
            </div>
          </div>
        `
      });

      toast.success('Boleto enviado com sucesso!');
      setShowBoletoModal(false);
      setBoletoFile(null);
      setQtdParcelas(1);
      setParcelas([{ dataVencimento: '', boletoFile: null }]);
      loadPedidos();
    } catch (error) {
      console.error('Erro ao enviar boleto:', error);
      toast.error('Erro ao enviar boleto');
    } finally {
      setUploading(false);
    }
  };

  // Handler para atualizar NF (nota fiscal)
  const handleAtualizarNF = async () => {
    if (!nfFile || !nfNumero || !nfDataEmissao) {
      toast.info('Preencha o número, a data de emissão e envie a nota fiscal');
      return;
    }

    setUploading(true);
    try {
      const nfUpload = await UploadFile({ file: nfFile });

      await Pedido.update(selectedPedido.id, {
        nf_url: nfUpload.file_url,
        nf_numero: nfNumero,
        nf_data_upload: nfDataEmissao + 'T00:00:00'
      });

      // Notificar cliente
      try {
        const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
        if (cliente?.email) {
          await SendEmail({
            from_name: 'POLO B2B',
            to: cliente.email,
            subject: `Nota Fiscal Atualizada - NF #${nfNumero}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Nota Fiscal Atualizada</h1>
                </div>
                <div style="padding: 30px; background: white;">
                  <p>A nota fiscal do pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi atualizada.</p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Nova NF:</strong> #${nfNumero}</p>
                    <p><strong>Data de Emissão:</strong> ${new Date(nfDataEmissao).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${nfUpload.file_url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">
                      Baixar Nota Fiscal
                    </a>
                  </div>
                </div>
              </div>
            `
          });
        }
      } catch (emailError) {
        console.warn('Erro ao enviar email de NF atualizada:', emailError);
      }

      toast.success('Nota Fiscal atualizada com sucesso!');
      setShowAtualizarNFModal(false);
      setNfFile(null);
      setNfNumero('');
      setNfDataEmissao('');
      loadPedidos();
    } catch (error) {
      console.error('Erro ao atualizar NF:', error);
      toast.error('Erro ao atualizar nota fiscal');
    } finally {
      setUploading(false);
    }
  };

  // Handler para cancelar pedido
  const handleCancelarPedido = async () => {
    if (!motivoCancelamento) {
      toast.info('Informe o motivo do cancelamento');
      return;
    }

    try {
      await Pedido.update(selectedPedido.id, {
        status: 'cancelado',
        motivo_recusa: motivoCancelamento
      });

      // Cancelar todos os títulos/parcelas pendentes na carteira
      try {
        const titulosDoPedido = await Carteira.filter({ pedido_id: selectedPedido.id });
        const titulosPendentes = (titulosDoPedido || []).filter(t => t.status === 'pendente');
        for (const titulo of titulosPendentes) {
          await Carteira.update(titulo.id, { status: 'cancelado' });
        }
        if (titulosPendentes.length > 0) {
          toast.info(`${titulosPendentes.length} parcela(s) cancelada(s) na carteira`);
        }
      } catch (carteiraErr) {
        console.warn('Erro ao cancelar títulos da carteira:', carteiraErr);
      }

      // Notificar cliente
      const cliente = clientes.find(c => c.id === selectedPedido.comprador_user_id);
      await SendEmail({
        from_name: 'POLO B2B',
        to: cliente?.email,
        subject: `❌ Pedido Cancelado - #${selectedPedido.id.slice(-8).toUpperCase()}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">❌ Pedido Cancelado</h1>
            </div>
            <div style="padding: 30px; background: white;">
              <p>O pedido <strong>#${selectedPedido.id.slice(-8).toUpperCase()}</strong> foi cancelado.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Motivo:</strong> ${motivoCancelamento}
              </div>
              <p><strong>Valor do pedido:</strong> ${formatCurrency(selectedPedido.valor_total)}</p>
              <p style="margin-top: 20px;">Se tiver dúvidas, entre em contato conosco.</p>
            </div>
          </div>
        `
      });

      toast.info('Pedido cancelado');
      setShowCancelarModal(false);
      setMotivoCancelamento('');
      loadPedidos();
    } catch (error) {
      toast.error('Erro ao cancelar pedido');
    }
  };

  const handleExportPDF = () => {
    // Filtrar pedidos conforme permissão do usuário
    let pedidosParaExportar = pedidos;
    if (user?.role !== 'admin' && fornecedorAtual) {
      pedidosParaExportar = pedidos.filter(p => p.fornecedor_id === fornecedorAtual.id);
    }

    // Aplicar filtros atuais
    if (filtroStatus !== 'todos') {
      pedidosParaExportar = pedidosParaExportar.filter(p => p.status === filtroStatus);
    }

    // Definir colunas para o PDF
    const columns = [
      { key: 'id_formatado', label: 'Pedido' },
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'status', label: 'Status' },
      { key: 'valor_formatado', label: 'Valor' },
      { key: 'data_formatada', label: 'Data Pedido' },
      { key: 'nf_numero', label: 'NF' },
      { key: 'data_faturamento', label: 'Data Faturamento' }
    ];

    // Preparar dados para exportação
    const data = pedidosParaExportar.map(p => ({
      id_formatado: `#${p.id?.slice(-8).toUpperCase() || 'N/A'}`,
      cliente_nome: clientes.find(c => c.id === p.comprador_user_id)?.full_name || 'N/A',
      status: p.status?.charAt(0).toUpperCase() + p.status?.slice(1) || 'N/A',
      valor_formatado: formatCurrency(p.valor_total),
      data_formatada: formatDate(p.created_date),
      nf_numero: p.nf_numero || '-',
      data_faturamento: p.nf_data_upload ? formatDate(p.nf_data_upload) : '-'
    }));

    exportToPDF(data, columns, 'Relatório de Pedidos', `pedidos-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    let pedidosParaExportar = pedidos;
    if (user?.role !== 'admin' && fornecedorAtual) {
      pedidosParaExportar = pedidos.filter(p => p.fornecedor_id === fornecedorAtual.id);
    }
    if (filtroStatus !== 'todos') {
      pedidosParaExportar = pedidosParaExportar.filter(p => p.status === filtroStatus);
    }

    const columns = [
      { key: 'id_formatado', label: 'Pedido' },
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'status', label: 'Status' },
      { key: 'valor_formatado', label: 'Valor Total' },
      { key: 'valor_faturado', label: 'Valor Faturado' },
      { key: 'data_formatada', label: 'Data Pedido' },
      { key: 'data_prevista', label: 'Previsão Entrega' },
      { key: 'nf_numero', label: 'NF' },
      { key: 'data_faturamento', label: 'Data Faturamento' },
      { key: 'metodo_pagamento', label: 'Método Pagamento' }
    ];

    const data = pedidosParaExportar.map(p => ({
      id_formatado: `#${p.id?.slice(-8).toUpperCase() || 'N/A'}`,
      cliente_nome: clientes.find(c => c.id === p.comprador_user_id)?.full_name || clientes.find(c => c.id === p.comprador_user_id)?.empresa || 'N/A',
      status: p.status?.charAt(0).toUpperCase() + p.status?.slice(1) || 'N/A',
      valor_formatado: formatCurrency(p.valor_total),
      valor_faturado: formatCurrency(p.valor_faturado || 0),
      data_formatada: formatDate(p.created_date),
      data_prevista: p.data_prevista_entrega ? formatDate(p.data_prevista_entrega) : '-',
      nf_numero: p.nf_numero || '-',
      data_faturamento: p.nf_data_upload ? formatDate(p.nf_data_upload) : '-',
      metodo_pagamento: p.metodo_pagamento || '-'
    }));

    exportToCSV(data, columns, `pedidos-${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Relatório de Produção — agrega quantidade total por produto/cor
  const handleExportRelatorioProducao = () => {
    // Pedidos em produção ou aprovados (ainda não faturados por completo)
    const statusProducao = ['aprovado', 'em_producao', 'parcialmente_faturado'];
    let pedidosParaRelatorio = pedidos.filter(p => statusProducao.includes(p.status));

    // Se fornecedor, filtrar somente seus pedidos
    if (user?.role !== 'admin' && fornecedorAtual) {
      pedidosParaRelatorio = pedidosParaRelatorio.filter(p => p.fornecedor_id === fornecedorAtual.id);
    }

    if (pedidosParaRelatorio.length === 0) {
      toast.info('Nenhum pedido em produção para gerar relatório');
      return;
    }

    // Agregar itens por produto + cor
    const agregado = {};
    pedidosParaRelatorio.forEach(pedido => {
      let itens = pedido.itens || [];
      if (typeof itens === 'string') {
        try { itens = JSON.parse(itens); } catch (e) { itens = []; }
      }

      // Mês de entrega = data_prevista_entrega ou mês de criação
      const mesEntrega = pedido.data_prevista_entrega
        ? new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : new Date(pedido.created_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      itens.forEach(item => {
        const cor = item.cor_selecionada?.cor_nome || 'Sem cor';
        const key = `${item.produto_id || item.nome}_${cor}_${mesEntrega}`;

        if (!agregado[key]) {
          agregado[key] = {
            nome: item.nome || '',
            referencia_fornecedor: item.referencia_fornecedor || item.referencia || '',
            referencia_linx: item.referencia_linx || item.referencia_polo || '',
            cor: cor,
            preco_unitario: item.preco || 0,
            mes_entrega: mesEntrega,
            qtd_total_pecas: 0,
            qtd_grades: 0
          };
        }
        // Quantidade pendente em unidades de venda (grades ou peças avulsas)
        const qtdPendente = (item.quantidade || 0) - (item.qtd_faturada || 0) - (item.qtd_quebra || 0);
        const pendente = Math.max(0, qtdPendente);
        // Se venda por grade, calcular total de peças = grades * peças_por_grade
        const isGrade = item.tipo_venda === 'grade' && (item.total_pecas_grade || 0) > 0;
        if (isGrade) {
          agregado[key].qtd_grades += pendente;
          agregado[key].qtd_total_pecas += pendente * (item.total_pecas_grade || 1);
        } else {
          agregado[key].qtd_total_pecas += pendente;
        }
      });
    });

    const data = Object.values(agregado)
      .filter(r => r.qtd_total_pecas > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome) || a.cor.localeCompare(b.cor));

    if (data.length === 0) {
      toast.info('Nenhum item pendente de produção');
      return;
    }

    const columns = [
      { key: 'nome', label: 'Produto' },
      { key: 'referencia_fornecedor', label: 'Ref. Fornecedor' },
      { key: 'referencia_linx', label: 'Ref. Linx' },
      { key: 'cor', label: 'Cor / Variante' },
      { key: 'preco_unitario_fmt', label: 'Preço Unit.' },
      { key: 'mes_entrega', label: 'Mês Entrega' },
      { key: 'qtd_total_pecas', label: 'Qtd. Total Peças' },
      { key: 'qtd_grades', label: 'Qtd. Grades' }
    ];

    const dataFormatted = data.map(r => ({
      ...r,
      preco_unitario_fmt: formatCurrency(r.preco_unitario)
    }));

    exportToCSV(dataFormatted, columns, `relatorio-producao-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`Relatório gerado com ${data.length} produto(s)`);
  };

  const resetFaturarForm = () => {
    setNfFile(null);
    setBoletoFile(null);
    setNfNumero('');
    setMetodoPagamento('');
    setQtdParcelas(1);
    setParcelas([{ dataVencimento: '', boletoFile: null }]);
    setBoletoUnico(false);
    setBoletoUnicoFile(null);
    setValorFreteFOB('');
  };

  // --- Boleto por NF (modal dedicado) ---
  const handleOpenBoletoNFModal = async (pedido) => {
    setSelectedPedido(pedido);
    setBoletoNFSelected(null);
    setBoletoNFFile(null);
    setBoletoNFQtdParcelas(1);
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 30);
    setBoletoNFParcelas([{ dataVencimento: hoje.toISOString().split('T')[0] }]);
    setBoletoNFLoading(true);
    setShowBoletoNFModal(true);
    try {
      const list = await Faturamento.filter({ pedido_id: pedido.id }, '-created_date');
      setBoletoNFList(list || []);
    } catch (e) {
      toast.error('Erro ao carregar notas fiscais');
      setBoletoNFList([]);
    } finally {
      setBoletoNFLoading(false);
    }
  };

  const handleBoletoNFQtdChange = (value) => {
    const num = parseInt(value) || 1;
    setBoletoNFQtdParcelas(num);
    const hoje = new Date();
    const novas = Array.from({ length: num }, (_, i) => {
      if (boletoNFParcelas[i]?.dataVencimento) return boletoNFParcelas[i];
      const data = new Date(hoje);
      data.setDate(data.getDate() + 30 * (i + 1));
      return { dataVencimento: data.toISOString().split('T')[0] };
    });
    setBoletoNFParcelas(novas);
  };

  const handleBoletoNFDataChange = (index, value) => {
    const novas = [...boletoNFParcelas];
    novas[index] = { ...novas[index], dataVencimento: value };
    setBoletoNFParcelas(novas);
  };

  const handleEnviarBoletoNF = async () => {
    if (!boletoNFSelected) { toast.info('Selecione uma Nota Fiscal'); return; }
    if (!boletoNFFile) { toast.info('Selecione o arquivo do boleto'); return; }
    const temDatas = boletoNFParcelas.some(p => p.dataVencimento);
    if (temDatas && boletoNFParcelas.some(p => !p.dataVencimento)) {
      toast.info('Preencha todas as datas de vencimento');
      return;
    }
    setBoletoNFUploading(true);
    try {
      const result = await UploadFile({ file: boletoNFFile });
      await Faturamento.update(boletoNFSelected.id, {
        boleto_url: result.file_url,
        boleto_data_upload: new Date().toISOString(),
        qtd_parcelas: boletoNFQtdParcelas
      });
      // Criar parcelas na carteira
      if (temDatas) {
        const valorBase = boletoNFSelected.valor_total || 0;
        const valorParcela = valorBase / boletoNFQtdParcelas;
        for (let i = 0; i < boletoNFQtdParcelas; i++) {
          await Carteira.create({
            pedido_id: selectedPedido.id,
            faturamento_id: boletoNFSelected.id,
            tipo: 'a_receber',
            status: 'pendente',
            valor: valorParcela,
            data_vencimento: boletoNFParcelas[i].dataVencimento,
            parcela_numero: i + 1,
            total_parcelas: boletoNFQtdParcelas,
            boleto_url: result.file_url,
            descricao: boletoNFQtdParcelas > 1
              ? `Parcela ${i + 1}/${boletoNFQtdParcelas} - NF #${boletoNFSelected.numero_nf}`
              : `Boleto - NF #${boletoNFSelected.numero_nf}`,
            loja_id: selectedPedido.loja_id || null,
            cliente_user_id: selectedPedido.comprador_user_id || null,
            fornecedor_id: selectedPedido.fornecedor_id || null
          });
        }
      }
      toast.success(`Boleto enviado para NF #${boletoNFSelected.numero_nf}!`);
      setShowBoletoNFModal(false);
      loadPedidos();
    } catch (error) {
      console.error('Erro ao enviar boleto:', error);
      toast.error('Erro ao enviar boleto: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setBoletoNFUploading(false);
    }
  };

  // Função para atualizar quantidade de parcelas
  const handleQtdParcelasChange = (qtd) => {
    const novaQtd = parseInt(qtd) || 1;
    setQtdParcelas(novaQtd);

    // Calcular datas sugeridas (30 em 30 dias a partir de hoje)
    const novasParcelas = [];
    for (let i = 0; i < novaQtd; i++) {
      const dataBase = new Date();
      dataBase.setDate(dataBase.getDate() + (30 * (i + 1)));
      novasParcelas.push({
        dataVencimento: parcelas[i]?.dataVencimento || dataBase.toISOString().split('T')[0],
        boletoFile: parcelas[i]?.boletoFile || null
      });
    }
    setParcelas(novasParcelas);
  };

  // Função para atualizar data de uma parcela específica
  const handleParcelaDataChange = (index, data) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index] = { ...novasParcelas[index], dataVencimento: data };
    setParcelas(novasParcelas);
  };

  // Função para atualizar boleto de uma parcela específica
  const handleParcelaBoletoChange = (index, file) => {
    const novasParcelas = [...parcelas];
    novasParcelas[index] = { ...novasParcelas[index], boletoFile: file };
    setParcelas(novasParcelas);
  };

  const resetEnvioForm = () => {
    setTransportadora('');
    setCodigoRastreio('');
    setLinkRastreio('');
    setDataEnvio('');
    setTipoFrete('CIF');
    setValorFreteFOB('');
    setFreteInclusoBoleto(false);
    setFreteModoCobr('diluido');
  };

  // Helper objects for status badges, used in the CardHeader
  const statusColors = {
    novo_pedido: 'bg-blue-100 text-blue-800',
    em_producao: 'bg-purple-100 text-purple-800',
    faturado: 'bg-indigo-100 text-indigo-800',
    em_transporte: 'bg-orange-100 text-orange-800',
    pendente_pagamento: 'bg-amber-100 text-amber-800',
    finalizado: 'bg-green-100 text-green-800',
    parcialmente_faturado: 'bg-cyan-100 text-cyan-800',
    cancelado: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    novo_pedido: 'Novo',
    em_producao: 'Em Produção',
    faturado: 'Faturado',
    em_transporte: 'Em Transporte',
    pendente_pagamento: 'Aguardando Pagamento',
    finalizado: 'Finalizado',
    parcialmente_faturado: 'Parcial. Faturado',
    cancelado: 'Cancelado',
  };

  const getStatusBadge = (status) => {
    const badges = {
      novo_pedido: { label: 'Novo Pedido', color: 'bg-blue-100 text-blue-800' },
      em_producao: { label: 'Em Produção', color: 'bg-purple-100 text-purple-800' },
      faturado: { label: 'Faturado', color: 'bg-indigo-100 text-indigo-800' },
      em_transporte: { label: 'Em Transporte', color: 'bg-orange-100 text-orange-800' },
      pendente_pagamento: { label: 'Aguardando Pagamento', color: 'bg-amber-100 text-amber-800' },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' },
      parcialmente_faturado: { label: 'Parcialmente Faturado', color: 'bg-cyan-100 text-cyan-800' },
      cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' }
    };
    return badges[status] || badges.novo_pedido;
  };

  const limparFiltrosDatas = () => {
    setFiltroEmissaoDe('');
    setFiltroEmissaoAte('');
    setFiltroFaturamentoDe('');
    setFiltroFaturamentoAte('');
    setFiltroMes('todos');
  };

  const temFiltroData = filtroEmissaoDe || filtroEmissaoAte || filtroFaturamentoDe || filtroFaturamentoAte;

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

    // Filtro por data de emissão
    let matchesEmissao = true;
    if (filtroEmissaoDe) {
      const dataEmissao = pedido.created_date?.split('T')[0];
      if (!dataEmissao || dataEmissao < filtroEmissaoDe) matchesEmissao = false;
    }
    if (filtroEmissaoAte) {
      const dataEmissao = pedido.created_date?.split('T')[0];
      if (!dataEmissao || dataEmissao > filtroEmissaoAte) matchesEmissao = false;
    }

    // Filtro por data de faturamento
    let matchesFaturamento = true;
    if (filtroFaturamentoDe || filtroFaturamentoAte) {
      const dataFat = pedido.nf_data_upload?.split('T')[0];
      if (!dataFat) {
        matchesFaturamento = false;
      } else {
        if (filtroFaturamentoDe && dataFat < filtroFaturamentoDe) matchesFaturamento = false;
        if (filtroFaturamentoAte && dataFat > filtroFaturamentoAte) matchesFaturamento = false;
      }
    }

    return matchesSearch && matchesStatus && matchesMes && matchesEmissao && matchesFaturamento;
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
    !['faturado', 'parcialmente_faturado', 'em_transporte', 'finalizado', 'cancelado'].includes(p.status)
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportRelatorioProducao} variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <BarChart3 className="w-4 h-4 mr-2" />
            Relatório Produção
          </Button>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
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
                <SelectItem value="em_producao">Em Produção</SelectItem>
                <SelectItem value="parcialmente_faturado">Parcialmente Faturados</SelectItem>
                <SelectItem value="faturado">Faturados</SelectItem>
                <SelectItem value="em_transporte">Em Transporte</SelectItem>
                <SelectItem value="pendente_pagamento">Aguardando Pagamento</SelectItem>
                <SelectItem value="finalizado">Finalizados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
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

          {/* Filtros por data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Data de Emissão</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={filtroEmissaoDe}
                  onChange={(e) => setFiltroEmissaoDe(e.target.value)}
                  placeholder="De"
                  title="Data emissão - De"
                />
                <Input
                  type="date"
                  value={filtroEmissaoAte}
                  onChange={(e) => setFiltroEmissaoAte(e.target.value)}
                  placeholder="Até"
                  title="Data emissão - Até"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 font-medium">Data de Faturamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={filtroFaturamentoDe}
                  onChange={(e) => setFiltroFaturamentoDe(e.target.value)}
                  placeholder="De"
                  title="Data faturamento - De"
                />
                <Input
                  type="date"
                  value={filtroFaturamentoAte}
                  onChange={(e) => setFiltroFaturamentoAte(e.target.value)}
                  placeholder="Até"
                  title="Data faturamento - Até"
                />
              </div>
            </div>
          </div>
          {temFiltroData && (
            <div className="mt-2">
              <Button variant="ghost" size="sm" onClick={limparFiltrosDatas} className="text-xs text-gray-500">
                Limpar filtros de data
              </Button>
            </div>
          )}
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

            // Debug: log if cliente or fornecedor not found
            if (!cliente) {
              console.warn(`Cliente não encontrado para pedido ${pedido.id}. comprador_user_id: ${pedido.comprador_user_id}`);
              console.warn('Pedido completo:', pedido);
              console.warn('Lista de clientes disponíveis:', clientes.map(c => ({ id: c.id, nome: c.full_name, empresa: c.empresa })));
            }
            if (!fornecedor) {
              console.warn(`Fornecedor não encontrado para pedido ${pedido.id}. fornecedor_id: ${pedido.fornecedor_id}`);
            }

            // Verificar se o cliente está inadimplente ou bloqueado
            const clienteInadimplente = cliente?.bloqueado || (cliente?.total_vencido || 0) > 0;
            const clienteBloqueado = cliente?.bloqueado;

            // Tentar extrair nome do cliente do pedido se não encontrado na lista
            const nomeCliente = cliente?.empresa || cliente?.razao_social || cliente?.nome_marca || cliente?.full_name || pedido.comprador_nome || 'Cliente não encontrado';

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
                      <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                        {nomeCliente}
                        {cliente?.tipo_negocio === 'multimarca' && (
                          <Badge className="bg-purple-100 text-purple-800 border border-purple-300 text-[10px] px-2 py-0.5">Multimarca</Badge>
                        )}
                        {cliente?.tipo_negocio === 'franqueado' && (
                          <Badge className="bg-blue-100 text-blue-800 border border-blue-300 text-[10px] px-2 py-0.5">Franqueado</Badge>
                        )}
                      </CardTitle>
                      {cliente?.full_name && nomeCliente !== cliente.full_name && (
                        <p className="text-sm text-gray-500">{cliente.full_name}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Pedido #{pedido.id.slice(-8).toUpperCase()} • {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                      </p>
                      {pedido.loja_id && lojasMap[pedido.loja_id] && (
                        <p className="text-sm text-blue-600 flex items-center gap-1 mt-0.5">
                          <Store className="w-3 h-3" />
                          {lojasMap[pedido.loja_id].nome_fantasia || lojasMap[pedido.loja_id].nome}
                          {lojasMap[pedido.loja_id].cidade ? ` - ${lojasMap[pedido.loja_id].cidade}/${lojasMap[pedido.loja_id].estado || ''}` : ''}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        Fornecedor: {fornecedor?.nome_marca || 'Não identificado'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pedido.impresso && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Impresso
                        </Badge>
                      )}
                      <Badge className={statusColors[pedido.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[pedido.status] || pedido.status}
                      </Badge>
                    </div>
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
                            Total em aberto: {formatCurrency(cliente.total_em_aberto || 0)}
                          </>
                        ) : (
                          <>
                            <strong>Cliente com valores vencidos.</strong>
                            <br />
                            Total vencido: {formatCurrency(cliente.total_vencido || 0)}
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
                            {formatCurrency(pedido.valor_total)}
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
                              {new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}
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
                      {/* Ações operacionais do fornecedor (não disponíveis para admin) */}
                      {user?.role !== 'admin' && (
                        <>
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

                          {(pedido.status === 'em_producao' || pedido.status === 'parcialmente_faturado') && (
                            <>
                              <Button
                                onClick={() => {
                                  setSelectedPedido(pedido);
                                  setNfNumero('');
                                  setNfDataEmissao(new Date().toISOString().split('T')[0]);
                                  setNfFile(null);
                                  setMetodoPagamento(pedido.metodo_pagamento || '');
                                  // Initialize items for partial invoicing
                                  let rawItens = pedido.itens || [];
                                  if (typeof rawItens === 'string') { try { rawItens = JSON.parse(rawItens); } catch(e) { rawItens = []; } }
                                  const items = rawItens.map((item, idx) => ({
                                    ...item,
                                    _index: idx,
                                    _selected: false,
                                    _qtdFaturar: 0,
                                    _isQuebra: false,
                                    _qtdQuebra: 0,
                                    _saldo: (item.quantidade || 0) - (item.qtd_faturada || 0) - (item.qtd_quebra || 0)
                                  }));
                                  setItensFaturamento(items);
                                  setShowFaturarModal(true);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Faturar Pedido
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleMudarMetodoPagamento(pedido, pedido.metodo_pagamento === 'boleto' ? 'a_vista' : 'boleto')}
                              >
                                Mudar para {pedido.metodo_pagamento === 'boleto' ? 'À Vista' : 'Boleto'}
                              </Button>
                            </>
                          )}

                          {(pedido.status === 'faturado' || pedido.status === 'parcialmente_faturado') && (
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

                          {/* Botão para atualizar NF separadamente */}
                          {['faturado', 'parcialmente_faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'].includes(pedido.status) && pedido.nf_url && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedPedido(pedido);
                                setNfNumero(pedido.nf_numero || '');
                                setNfDataEmissao(pedido.nf_data_upload ? pedido.nf_data_upload.split('T')[0] : '');
                                setNfFile(null);
                                setShowAtualizarNFModal(true);
                              }}
                              className="border-indigo-300 text-indigo-700"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Atualizar NF
                            </Button>
                          )}

                          {/* Botão para enviar boleto — abre modal dedicado com seleção de NF */}
                          {['faturado', 'parcialmente_faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'].includes(pedido.status) && (
                            <Button
                              variant="outline"
                              onClick={() => handleOpenBoletoNFModal(pedido)}
                              className={pedido.boleto_url ? 'border-green-300 text-green-700' : ''}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {pedido.boleto_url ? 'Atualizar Boleto' : 'Enviar Boleto'}
                            </Button>
                          )}
                        </>
                      )}

                      {/* Botão para ver comprovante do cliente */}
                      {pedido.comprovante_pagamento_url && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(pedido.comprovante_pagamento_url, '_blank')}
                          className="border-blue-300 text-blue-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Comprovante
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setDetailsDefaultTab('itens');
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>

                      {/* Botão para cancelar pedido - não aparece em novo_pedido (usar Recusar), cancelado ou finalizado */}
                      {!['novo_pedido', 'cancelado', 'finalizado'].includes(pedido.status) && (
                        <Button
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setSelectedPedido(pedido);
                            setShowCancelarModal(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar Pedido
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

      {/* Modal de Faturamento Parcial */}
      <Dialog open={showFaturarModal} onOpenChange={setShowFaturarModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faturar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Resumo do pedido */}
            {selectedPedido && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <p className="text-sm text-gray-600">Pedido #{selectedPedido.id.slice(-8).toUpperCase()}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-gray-500">Valor Total:</span>
                    <p className="font-bold">{formatCurrency(selectedPedido.valor_total || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Já Faturado:</span>
                    <p className="font-bold text-green-600">{formatCurrency(selectedPedido.valor_faturado || 0)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Saldo Pendente:</span>
                    <p className="font-bold text-blue-600">
                      {formatCurrency((selectedPedido.valor_total || 0) - (selectedPedido.valor_faturado || 0) - (selectedPedido.valor_quebra || 0))}
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
                value={metodoPagamento || selectedPedido?.metodo_pagamento || ''}
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
                      accept=".pdf,.jpg,.jpeg,.png,.crm"
                      onChange={(e) => setNfFile(e.target.files[0])}
                    />
                  </div>
                </>
              );
            })()}

            {/* Real-time summary */}
            {selectedPedido && (() => {
              const selecionados = itensFaturamento.filter(it => it._selected);
              const valorFat = selecionados.filter(it => !it._isQuebra).reduce((s, it) => s + (it._qtdFaturar * (it.preco || 0)), 0);
              const valorQuebra = selecionados.filter(it => it._isQuebra).reduce((s, it) => s + (it._qtdQuebra * (it.preco || 0)), 0);
              const saldoApos = (selectedPedido.valor_total || 0) - (selectedPedido.valor_faturado || 0) - (selectedPedido.valor_quebra || 0) - valorFat - valorQuebra;
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
              <Button variant="outline" onClick={() => setShowFaturarModal(false)}>
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

      {/* Modal de Envio */}
      <Dialog open={showEnvioModal} onOpenChange={setShowEnvioModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="codigoRastreio">Codigo de Rastreio</Label>
              <Input
                id="codigoRastreio"
                value={codigoRastreio}
                onChange={(e) => setCodigoRastreio(e.target.value)}
                placeholder="Ex: BR123456789BR"
              />
            </div>

            <div>
              <Label htmlFor="linkRastreio">Link de Rastreio</Label>
              <Input
                id="linkRastreio"
                value={linkRastreio}
                onChange={(e) => setLinkRastreio(e.target.value)}
                placeholder="Cole o link de rastreio da transportadora"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cole o link direto do site da transportadora para o cliente rastrear
              </p>
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

            {/* Tipo de Frete */}
            <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
              <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Tipo de Frete
              </h4>

              <RadioGroup value={tipoFrete} onValueChange={(val) => {
                setTipoFrete(val);
                if (val === 'CIF') {
                  setValorFreteFOB('');
                  setFreteInclusoBoleto(false);
                  setFreteModoCobr('diluido');
                }
              }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CIF" id="frete-cif" />
                  <Label htmlFor="frete-cif" className="cursor-pointer">
                    <span className="font-medium">CIF</span>
                    <span className="text-xs text-gray-500 ml-1">- Frete por conta do fornecedor</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FOB" id="frete-fob" />
                  <Label htmlFor="frete-fob" className="cursor-pointer">
                    <span className="font-medium">FOB</span>
                    <span className="text-xs text-gray-500 ml-1">- Frete por conta do cliente</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* Campos FOB */}
              {tipoFrete === 'FOB' && (
                <div className="space-y-4 pt-2 border-t border-blue-200">
                  {/* Valor do Frete */}
                  <div>
                    <Label htmlFor="valorFreteFOB">Valor do Frete (R$) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                      <Input
                        id="valorFreteFOB"
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorFreteFOB}
                        onChange={(e) => setValorFreteFOB(e.target.value)}
                        placeholder="0,00"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Incluir no Boleto */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="freteInclusoBoleto" className="cursor-pointer">Incluir frete no boleto?</Label>
                      <p className="text-xs text-gray-500">O valor do frete sera somado ao valor do pedido</p>
                    </div>
                    <Switch
                      id="freteInclusoBoleto"
                      checked={freteInclusoBoleto}
                      onCheckedChange={setFreteInclusoBoleto}
                    />
                  </div>

                  {/* Modo de Cobranca */}
                  {freteInclusoBoleto && (
                    <div className="space-y-2">
                      <Label>Modo de cobranca do frete</Label>
                      <RadioGroup value={freteModoCobr} onValueChange={setFreteModoCobr}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="diluido" id="cobr-diluido" />
                          <Label htmlFor="cobr-diluido" className="cursor-pointer text-sm">
                            Diluir nas parcelas
                            <span className="text-xs text-gray-500 ml-1">- Frete dividido igualmente entre as parcelas</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="primeiro_boleto" id="cobr-primeiro" />
                          <Label htmlFor="cobr-primeiro" className="cursor-pointer text-sm">
                            Cobrar no primeiro boleto
                            <span className="text-xs text-gray-500 ml-1">- Frete integral na 1a parcela</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Resumo de valores */}
                  {parseFloat(valorFreteFOB) > 0 && selectedPedido && (
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Valor dos Produtos:</span>
                        <span>{formatCurrency(selectedPedido.valor_total || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Frete FOB:</span>
                        <span>{formatCurrency(parseFloat(valorFreteFOB))}</span>
                      </div>
                      {freteInclusoBoleto && (
                        <div className="flex justify-between font-bold text-sm pt-2 border-t">
                          <span>Total (com frete no boleto):</span>
                          <span className="text-green-600">
                            {formatCurrency((selectedPedido.valor_total || 0) + parseFloat(valorFreteFOB))}
                          </span>
                        </div>
                      )}
                      {!freteInclusoBoleto && (
                        <div className="text-xs text-gray-500 pt-2 border-t">
                          Frete sera cobrado separadamente (nao incluso no boleto)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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

      {/* Modal de Boleto por NF (dedicado) */}
      <Dialog open={showBoletoNFModal} onOpenChange={setShowBoletoNFModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Enviar Boleto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPedido && (
              <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                <p>Pedido <strong>#{selectedPedido.id?.slice(-8).toUpperCase()}</strong></p>
                <p className="text-gray-500">Valor: {formatCurrency(selectedPedido.valor_total || 0)}</p>
              </div>
            )}

            {/* Passo 1: Selecionar NF */}
            <div>
              <Label className="text-sm font-semibold">1. Selecione a Nota Fiscal</Label>
              {boletoNFLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : boletoNFList.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                  <p className="text-sm text-amber-800">Nenhuma NF encontrada para este pedido. Fature o pedido primeiro.</p>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {boletoNFList.map((fat) => (
                    <div
                      key={fat.id}
                      onClick={() => setBoletoNFSelected(fat)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        boletoNFSelected?.id === fat.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">NF #{fat.numero_nf}</p>
                          <p className="text-xs text-gray-500">
                            {fat.data_emissao ? new Date(fat.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} • {formatCurrency(fat.valor_total)}
                          </p>
                        </div>
                        <div>
                          {fat.boleto_url ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Boleto enviado</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600 text-xs">Sem boleto</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Passo 2: Configurar parcelas e upload — só aparece após selecionar NF */}
            {boletoNFSelected && (
              <>
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">2. Configure as parcelas</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <Label className="text-xs">Quantidade de Parcelas</Label>
                      <Select value={String(boletoNFQtdParcelas)} onValueChange={handleBoletoNFQtdChange}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="text-xs text-blue-800">
                        <p><strong>Valor NF:</strong> {formatCurrency(boletoNFSelected.valor_total)}</p>
                        <p><strong>Por parcela:</strong> {formatCurrency(boletoNFSelected.valor_total / boletoNFQtdParcelas)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-3">
                    <Label className="text-xs">Datas de Vencimento</Label>
                    {boletoNFParcelas.map((parcela, index) => (
                      <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                        <Badge variant="outline" className="text-xs shrink-0">{index + 1}/{boletoNFQtdParcelas}</Badge>
                        <span className="text-xs text-gray-500 shrink-0">{formatCurrency(boletoNFSelected.valor_total / boletoNFQtdParcelas)}</span>
                        <Input
                          type="date"
                          value={parcela.dataVencimento}
                          onChange={(e) => handleBoletoNFDataChange(index, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold">3. Envie o arquivo do boleto</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.crm"
                    onChange={(e) => setBoletoNFFile(e.target.files[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Formatos: PDF, JPG, PNG</p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowBoletoNFModal(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEnviarBoletoNF}
                    disabled={boletoNFUploading || !boletoNFFile}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {boletoNFUploading ? 'Enviando...' : 'Enviar Boleto'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Pedido */}
      {showDetailsModal && selectedPedido && (
        <PedidoDetailsModal
          pedido={selectedPedido}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPedido(null);
            setDetailsDefaultTab('itens');
          }}
          onUpdate={loadPedidos}
          currentUser={user}
          userMap={new Map(clientes.map(c => [c.id, c.full_name || c.empresa || c.razao_social || c.nome_marca]))}
          fornecedorMap={new Map(fornecedores.map(f => [f.id, f.razao_social || f.nome_fantasia]))}
          defaultTab={detailsDefaultTab}
        />
      )}

      {/* Modal de Envio de Boleto */}
      <Dialog open={showBoletoModal} onOpenChange={setShowBoletoModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar Boleto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPedido?.boleto_url && (
              <Alert className="bg-green-50 border-green-300">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Este pedido já possui um boleto anexado.
                  <Button
                    variant="link"
                    className="p-0 h-auto ml-2"
                    onClick={() => window.open(selectedPedido.boleto_url, '_blank')}
                  >
                    Ver boleto atual
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Configuração de Parcelas */}
            <div className="border rounded-lg p-4 bg-blue-50 space-y-4">
              <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Configuração de Parcelas
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="qtdParcelas">Quantidade de Parcelas</Label>
                  <Select value={String(qtdParcelas)} onValueChange={handleQtdParcelasChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-blue-800">
                    {selectedPedido?.valor_frete_fob > 0 && (
                      <p className="text-xs text-gray-600">
                        Produtos: {formatCurrency(selectedPedido?.valor_total)} + Frete: {formatCurrency(selectedPedido?.valor_frete_fob)}
                      </p>
                    )}
                    <p>
                      <strong>Valor total:</strong> {formatCurrency(selectedPedido?.valor_final || selectedPedido?.valor_total)}
                    </p>
                    <p>
                      <strong>Valor por parcela:</strong> {formatCurrency((selectedPedido?.valor_final || selectedPedido?.valor_total) / qtdParcelas)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Parcelas - datas de vencimento */}
              <div className="space-y-3">
                <Label>Datas de Vencimento *</Label>
                {parcelas.map((parcela, index) => (
                  <div key={index} className="bg-white p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-4">
                      <Badge className="bg-blue-600">Parcela {index + 1}/{qtdParcelas}</Badge>
                      <span className="text-sm text-gray-600">
                        {formatCurrency((selectedPedido?.valor_final || selectedPedido?.valor_total) / qtdParcelas)}
                      </span>
                      <div className="flex-1">
                        <Input
                          type="date"
                          value={parcela.dataVencimento}
                          onChange={(e) => handleParcelaDataChange(index, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="boletoFileModal">Upload do Boleto *</Label>
              <Input
                id="boletoFileModal"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.crm"
                onChange={(e) => setBoletoFile(e.target.files[0])}
              />
              <p className="text-xs text-gray-500 mt-1">
                <strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM
              </p>
              <p className="text-xs text-gray-500">
                O cliente será notificado por email e poderá baixar o boleto pelo sistema.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setShowBoletoModal(false);
                setBoletoFile(null);
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleEnviarBoleto}
                disabled={uploading || !boletoFile}
                className="bg-green-600 hover:bg-green-700"
              >
                {uploading ? 'Enviando...' : 'Enviar Boleto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Atualizar NF */}
      <Dialog open={showAtualizarNFModal} onOpenChange={setShowAtualizarNFModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Atualizar Nota Fiscal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPedido?.nf_url && (
              <Alert className="bg-indigo-50 border-indigo-300">
                <FileText className="h-4 w-4 text-indigo-600" />
                <AlertDescription className="text-indigo-800">
                  Este pedido já possui uma NF anexada
                  {selectedPedido.nf_numero && <> (NF #{selectedPedido.nf_numero})</>}.
                  <Button
                    variant="link"
                    className="p-0 h-auto ml-2"
                    onClick={() => window.open(selectedPedido.nf_url, '_blank')}
                  >
                    Ver NF atual
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nfNumeroAtualizar">Número da NF *</Label>
                <Input
                  id="nfNumeroAtualizar"
                  value={nfNumero}
                  onChange={(e) => setNfNumero(e.target.value)}
                  placeholder="Ex: 12345"
                />
              </div>
              <div>
                <Label htmlFor="nfDataEmissaoAtualizar">Data de Emissão *</Label>
                <Input
                  id="nfDataEmissaoAtualizar"
                  type="date"
                  value={nfDataEmissao}
                  onChange={(e) => setNfDataEmissao(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nfFileAtualizar">Upload da Nota Fiscal *</Label>
              <Input
                id="nfFileAtualizar"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.crm"
                onChange={(e) => setNfFile(e.target.files[0])}
              />
              <p className="text-xs text-gray-500 mt-1">
                <strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM
              </p>
            </div>

            {/* Resumo do pedido */}
            {selectedPedido && (
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Pedido:</span>
                  <span className="font-mono">#{selectedPedido.id.slice(-8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(selectedPedido.valor_final || selectedPedido.valor_total || 0)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setShowAtualizarNFModal(false);
                setNfFile(null);
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleAtualizarNF}
                disabled={uploading || !nfFile || !nfNumero || !nfDataEmissao}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {uploading ? 'Enviando...' : 'Atualizar Nota Fiscal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelamento de Pedido */}
      <Dialog open={showCancelarModal} onOpenChange={setShowCancelarModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Cancelar Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedPedido && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>Atenção:</strong> Esta ação não pode ser desfeita. O cliente será notificado por e-mail.
                </AlertDescription>
              </Alert>
            )}

            {selectedPedido && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Pedido #{selectedPedido.id.slice(-8).toUpperCase()}</p>
                <p className="font-semibold text-lg">{formatCurrency(selectedPedido.valor_total)}</p>
                <p className="text-sm text-gray-600">Status atual: {statusLabels[selectedPedido.status] || selectedPedido.status}</p>
              </div>
            )}

            <div>
              <Label htmlFor="motivoCancelamento">Motivo do Cancelamento *</Label>
              <Textarea
                id="motivoCancelamento"
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Explique o motivo do cancelamento..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setShowCancelarModal(false);
                setMotivoCancelamento('');
              }}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelarPedido}
                disabled={!motivoCancelamento}
              >
                Confirmar Cancelamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
