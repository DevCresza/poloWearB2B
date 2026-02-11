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
  Phone, Mail, CreditCard, Upload, AlertTriangle, Pencil, ChevronDown, ChevronUp
} from 'lucide-react';
import { Pedido } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { User as UserEntity } from '@/api/entities';
import { Loja } from '@/api/entities';
import { UploadFile, SendEmail } from '@/api/integrations';
import { formatDateTime, formatCurrency } from '@/utils/exportUtils';
import { Store } from 'lucide-react';

export default function PedidoDetailsModal({ pedido, onClose, onUpdate, currentUser, userMap, fornecedorMap }) {
  const [lojaInfo, setLojaInfo] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [boletoFile, setBoletoFile] = useState(null);
  const [nfFile, setNfFile] = useState(null);
  const [nfNumero, setNfNumero] = useState(pedido.nf_numero || '');
  const [nfDataEmissao, setNfDataEmissao] = useState('');

  // Estados para configuração de parcelas do boleto (aba Documentos)
  const [qtdParcelasBoleto, setQtdParcelasBoleto] = useState(1);
  const [parcelasBoletoConfig, setParcelasBoletoConfig] = useState([{ dataVencimento: '' }]);

  // Estados para parcelas/títulos
  const [parcelas, setParcelas] = useState([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [parcelaSelecionada, setParcelaSelecionada] = useState(null);
  const [showUploadParcelaModal, setShowUploadParcelaModal] = useState(false);
  const [comprovanteParcelaFile, setComprovanteParcelaFile] = useState(null);
  const [dataPagamentoParcela, setDataPagamentoParcela] = useState('');
  const [uploadingParcela, setUploadingParcela] = useState(false);

  // Toggle para formulários de atualização na aba Documentos
  const [showEditBoleto, setShowEditBoleto] = useState(false);
  const [showEditNF, setShowEditNF] = useState(false);

  // Modal para confirmar data de pagamento ao marcar parcela como "Pago" manualmente
  const [showConfirmarPagoModal, setShowConfirmarPagoModal] = useState(false);
  const [parcelaParaMarcarPago, setParcelaParaMarcarPago] = useState(null);
  const [dataPagamentoManual, setDataPagamentoManual] = useState('');

  // Estados para aprovação/recusa de comprovante por parcela
  const [showAprovacaoParcelaModal, setShowAprovacaoParcelaModal] = useState(false);
  const [showRecusaParcelaModal, setShowRecusaParcelaModal] = useState(false);
  const [parcelaParaAprovar, setParcelaParaAprovar] = useState(null);
  const [parcelaParaRecusar, setParcelaParaRecusar] = useState(null);
  const [dataPagamentoConfirmada, setDataPagamentoConfirmada] = useState('');
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [processandoAprovacao, setProcessandoAprovacao] = useState(false);

  // Estados para frete FOB
  const [valorFreteFOB, setValorFreteFOB] = useState(pedido.valor_frete_fob || '');
  const [salvandoFrete, setSalvandoFrete] = useState(false);
  const [marcandoEntregue, setMarcandoEntregue] = useState(false);

  // Verificar se é cliente (somente visualização)
  const isCliente = currentUser?.tipo_negocio === 'multimarca' || currentUser?.tipo_negocio === 'franqueado';

  // Verificar se usuário pode fazer upload (fornecedor ou admin, nunca cliente)
  const canUpload = !isCliente && (currentUser?.role === 'admin' || currentUser?.tipo_negocio === 'fornecedor');

  // Carregar parcelas do pedido
  // Load loja info if pedido has loja_id
  useEffect(() => {
    if (pedido?.loja_id) {
      Loja.get(pedido.loja_id).then(setLojaInfo).catch(() => setLojaInfo(null));
    } else {
      setLojaInfo(null);
    }
  }, [pedido?.loja_id]);

  useEffect(() => {
    const loadParcelas = async () => {
      if (!pedido?.id) return;
      setLoadingParcelas(true);
      try {
        const titulosList = await Carteira.filter({ pedido_id: pedido.id });
        // Filtrar apenas parcelas reais (tipo a_receber com parcela_numero),
        // excluindo o placeholder criado pelo Carrinho (tipo a_pagar)
        const parcelasReais = (titulosList || []).filter(t => t.parcela_numero);
        // Ordenar por data de vencimento
        const sorted = parcelasReais.sort((a, b) =>
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

  // Salvar frete FOB
  const handleSalvarFrete = async () => {
    setSalvandoFrete(true);
    try {
      const frete = parseFloat(valorFreteFOB) || 0;
      const valorFinal = (pedido.valor_total || 0) + frete;
      await Pedido.update(pedido.id, {
        valor_frete_fob: frete,
        valor_final: valorFinal
      });
      toast.success('Frete atualizado com sucesso!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao salvar frete:', error);
      toast.error('Erro ao salvar frete');
    } finally {
      setSalvandoFrete(false);
    }
  };

  // Marcar pedido como entregue (fornecedor/admin)
  const handleMarcarEntregue = async () => {
    setMarcandoEntregue(true);
    try {
      let todasPagas = false;
      try {
        const titulosDoPedido = await Carteira.filter({ pedido_id: pedido.id });
        const parcelasReais = (titulosDoPedido || []).filter(t => t.parcela_numero);
        todasPagas = parcelasReais.length > 0
          ? parcelasReais.every(t => t.status === 'pago')
          : pedido.status_pagamento === 'pago';
      } catch (e) {
        console.warn('Erro ao verificar parcelas:', e);
        todasPagas = pedido.status_pagamento === 'pago';
      }

      const novoStatus = todasPagas ? 'finalizado' : 'pendente_pagamento';

      await Pedido.update(pedido.id, {
        status: novoStatus,
        cliente_confirmou_recebimento: true,
        data_confirmacao_recebimento: new Date().toISOString().split('T')[0]
      });

      toast.success(novoStatus === 'finalizado'
        ? 'Pedido entregue e finalizado (todas parcelas pagas)!'
        : 'Pedido marcado como entregue! Aguardando pagamento.'
      );
      onUpdate();
    } catch (error) {
      console.error('Erro ao marcar pedido como entregue:', error);
      toast.error('Erro ao marcar pedido como entregue');
    } finally {
      setMarcandoEntregue(false);
    }
  };

  // Helpers para parcelas do boleto
  const handleQtdParcelasBoletoChange = (value) => {
    const num = parseInt(value);
    setQtdParcelasBoleto(num);
    const novasParcelas = Array.from({ length: num }, (_, i) => ({
      dataVencimento: parcelasBoletoConfig[i]?.dataVencimento || ''
    }));
    setParcelasBoletoConfig(novasParcelas);
  };

  const handleParcelaBoletoDataChange = (index, value) => {
    const novas = [...parcelasBoletoConfig];
    novas[index] = { ...novas[index], dataVencimento: value };
    setParcelasBoletoConfig(novas);
  };

  // Verificações de parcelas pagas para controle de edição do boleto
  const todasParcelasPagas = parcelas.length > 0 && parcelas.every(p => p.status === 'pago');
  const temParcelaPaga = parcelas.some(p => p.status === 'pago');

  // Abrir edição do boleto com dados pré-preenchidos das parcelas existentes
  const handleOpenEditBoleto = () => {
    if (parcelas.length > 0) {
      setQtdParcelasBoleto(parcelas.length);
      setParcelasBoletoConfig(parcelas.map(p => ({
        dataVencimento: p.data_vencimento || '',
        parcelaId: p.id,
        isPago: p.status === 'pago',
        valor: p.valor || 0
      })));
    }
    setBoletoFile(null);
    setShowEditBoleto(true);
  };

  // Alterar quantidade de parcelas no modo edição (preserva pagas)
  const handleQtdParcelasEditChange = (value) => {
    const num = parseInt(value);
    const parcelasPagasCount = parcelasBoletoConfig.filter(p => p.isPago).length;

    if (num < parcelasPagasCount) {
      toast.info(`Mínimo de ${parcelasPagasCount} parcela(s) - existem parcelas já pagas`);
      return;
    }

    setQtdParcelasBoleto(num);

    if (num > parcelasBoletoConfig.length) {
      // Adicionar novas parcelas no final
      const novas = [...parcelasBoletoConfig];
      for (let i = parcelasBoletoConfig.length; i < num; i++) {
        novas.push({ dataVencimento: '', isPago: false });
      }
      setParcelasBoletoConfig(novas);
    } else if (num < parcelasBoletoConfig.length) {
      // Remover parcelas não-pagas do final
      const result = [...parcelasBoletoConfig];
      while (result.length > num) {
        let lastNonPaidIdx = -1;
        for (let i = result.length - 1; i >= 0; i--) {
          if (!result[i].isPago) { lastNonPaidIdx = i; break; }
        }
        if (lastNonPaidIdx >= 0) {
          result.splice(lastNonPaidIdx, 1);
        } else break;
      }
      setParcelasBoletoConfig(result);
    }
  };

  // Upload de Boleto (primeiro envio - cria parcelas)
  const handleUploadBoleto = async () => {
    if (!boletoFile) {
      toast.info('Selecione o arquivo do boleto');
      return;
    }
    const temParcelasConfiguradas = parcelasBoletoConfig.some(p => p.dataVencimento);
    if (temParcelasConfiguradas && parcelasBoletoConfig.some(p => !p.dataVencimento)) {
      toast.info('Preencha todas as datas de vencimento das parcelas');
      return;
    }
    setUploading(true);
    try {
      const result = await UploadFile({ file: boletoFile });
      await Pedido.update(pedido.id, {
        boleto_url: result.file_url,
        boleto_data_upload: new Date().toISOString()
      });

      if (temParcelasConfiguradas) {
        // Deletar apenas parcelas não pagas (preservar parcelas já quitadas)
        const parcelasAntigas = await Carteira.filter({ pedido_id: pedido.id });
        const parcelasReaisAntigas = (parcelasAntigas || []).filter(t => t.parcela_numero);
        for (const p of parcelasReaisAntigas) {
          if (p.status !== 'pago') {
            await Carteira.delete(p.id);
          }
        }

        const valorBase = pedido.valor_final || pedido.valor_total || 0;
        const valorParcela = valorBase / qtdParcelasBoleto;
        for (let i = 0; i < qtdParcelasBoleto; i++) {
          await Carteira.create({
            pedido_id: pedido.id,
            cliente_user_id: pedido.comprador_user_id,
            fornecedor_id: pedido.fornecedor_id,
            tipo: 'a_receber',
            valor: valorParcela,
            data_vencimento: parcelasBoletoConfig[i].dataVencimento,
            status: 'pendente',
            parcela_numero: i + 1,
            total_parcelas: qtdParcelasBoleto,
            boleto_url: result.file_url,
            descricao: qtdParcelasBoleto > 1
              ? `Parcela ${i + 1}/${qtdParcelasBoleto} - Pedido #${pedido.id.slice(-8).toUpperCase()}`
              : `Pedido #${pedido.id.slice(-8).toUpperCase()}`
          });
        }
      }

      toast.success('Boleto enviado com sucesso!');
      setBoletoFile(null);
      setQtdParcelasBoleto(1);
      setParcelasBoletoConfig([{ dataVencimento: '' }]);
      await reloadParcelas();
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao enviar boleto');
    } finally {
      setUploading(false);
    }
  };

  // Editar boleto existente (atualiza arquivo, datas, adiciona/remove parcelas não pagas)
  const handleEditBoleto = async () => {
    const parcelasEditaveis = parcelasBoletoConfig.filter(p => !p.isPago);
    if (parcelasEditaveis.some(p => !p.dataVencimento)) {
      toast.info('Preencha todas as datas de vencimento das parcelas pendentes');
      return;
    }

    const valorTotal = pedido.valor_final || pedido.valor_total || 0;
    const valorJaPago = parcelasBoletoConfig
      .filter(p => p.isPago)
      .reduce((sum, p) => sum + (p.valor || 0), 0);
    const valorRestante = valorTotal - valorJaPago;

    if (valorRestante < 0) {
      toast.error('O valor das parcelas pagas já excede o valor total do pedido');
      return;
    }

    const qtdEditaveis = parcelasEditaveis.length;
    const valorPorParcela = qtdEditaveis > 0 ? Math.round((valorRestante / qtdEditaveis) * 100) / 100 : 0;

    setUploading(true);
    try {
      let novaUrl = pedido.boleto_url;
      if (boletoFile) {
        const result = await UploadFile({ file: boletoFile });
        novaUrl = result.file_url;
        await Pedido.update(pedido.id, {
          boleto_url: novaUrl,
          boleto_data_upload: new Date().toISOString()
        });
      }

      // IDs das parcelas que devem permanecer
      const idsParcelasConfig = parcelasBoletoConfig
        .filter(p => p.parcelaId)
        .map(p => p.parcelaId);

      // Deletar parcelas não-pagas que foram removidas (redução de quantidade)
      const parcelasParaDeletar = parcelas.filter(
        p => p.status !== 'pago' && !idsParcelasConfig.includes(p.id)
      );
      for (const p of parcelasParaDeletar) {
        await Carteira.delete(p.id);
      }

      // Atualizar existentes e criar novas
      const totalParcelas = parcelasBoletoConfig.length;
      for (let i = 0; i < parcelasBoletoConfig.length; i++) {
        const config = parcelasBoletoConfig[i];
        const parcelaNum = i + 1;

        if (config.isPago && config.parcelaId) {
          // Parcela paga: só atualizar total_parcelas para exibição correta
          await Carteira.update(config.parcelaId, {
            parcela_numero: parcelaNum,
            total_parcelas: totalParcelas,
            boleto_url: novaUrl
          });
        } else if (config.parcelaId) {
          // Parcela existente não-paga: atualizar data, valor e URL
          await Carteira.update(config.parcelaId, {
            data_vencimento: config.dataVencimento,
            valor: valorPorParcela,
            parcela_numero: parcelaNum,
            total_parcelas: totalParcelas,
            boleto_url: novaUrl
          });
        } else {
          // Parcela nova: criar
          await Carteira.create({
            pedido_id: pedido.id,
            cliente_user_id: pedido.comprador_user_id,
            fornecedor_id: pedido.fornecedor_id,
            loja_id: pedido.loja_id,
            tipo: 'a_receber',
            valor: valorPorParcela,
            data_vencimento: config.dataVencimento,
            status: 'pendente',
            parcela_numero: parcelaNum,
            total_parcelas: totalParcelas,
            boleto_url: novaUrl,
            descricao: totalParcelas > 1
              ? `Parcela ${parcelaNum}/${totalParcelas} - Pedido #${pedido.id.slice(-8).toUpperCase()}`
              : `Pedido #${pedido.id.slice(-8).toUpperCase()}`
          });
        }
      }

      toast.success('Boleto atualizado com sucesso!');
      setBoletoFile(null);
      setShowEditBoleto(false);
      await reloadParcelas();
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao atualizar boleto');
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
    if (!nfNumero) {
      toast.info('Informe o número da nota fiscal');
      return;
    }
    setUploading(true);
    try {
      const result = await UploadFile({ file: nfFile });
      await Pedido.update(pedido.id, {
        nf_url: result.file_url,
        nf_numero: nfNumero,
        nf_data_upload: nfDataEmissao ? nfDataEmissao + 'T00:00:00' : new Date().toISOString(),
        status: pedido.status === 'em_producao' ? 'faturado' : pedido.status
      });
      toast.success('Nota Fiscal enviada com sucesso!');
      setNfFile(null);
      setNfDataEmissao('');
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
      pendente_pagamento: { label: 'Aguardando Pagamento', color: 'bg-amber-100 text-amber-800', icon: Clock },
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
      if (tipo === 'produto') {
        updateData.cliente_confirmou_recebimento = true;

        // Transição de status: em_transporte → pendente_pagamento ou finalizado
        if (pedido.status === 'em_transporte') {
          const titulosDoPedido = await Carteira.filter({ pedido_id: pedido.id });
          const parcelasReais = (titulosDoPedido || []).filter(t => t.parcela_numero);
          const todasPagas = parcelasReais.length > 0
            ? parcelasReais.every(t => t.status === 'pago')
            : pedido.status_pagamento === 'pago';
          updateData.status = todasPagas ? 'finalizado' : 'pendente_pagamento';
        }
      }

      await Pedido.update(pedido.id, updateData);
      onUpdate();
      toast.success('Confirmação registrada com sucesso!');
    } catch (_error) {
      toast.error('Erro ao registrar confirmação');
    } finally {
      setConfirmando(false);
    }
  };

  // Recarregar parcelas
  const reloadParcelas = async () => {
    try {
      const titulosList = await Carteira.filter({ pedido_id: pedido.id });
      const parcelasReais = (titulosList || []).filter(t => t.parcela_numero);
      const sorted = parcelasReais.sort((a, b) =>
        new Date(a.data_vencimento) - new Date(b.data_vencimento)
      );
      setParcelas(sorted);
    } catch (e) {
      console.error('Erro ao recarregar parcelas:', e);
    }
  };

  // Aprovar comprovante de parcela
  const handleAprovarParcela = async () => {
    if (!dataPagamentoConfirmada) {
      toast.error('Informe a data de pagamento');
      return;
    }
    setProcessandoAprovacao(true);
    try {
      await Carteira.update(parcelaParaAprovar.id, {
        comprovante_analisado: true,
        comprovante_aprovado: true,
        status: 'pago',
        data_pagamento: dataPagamentoConfirmada
      });

      // Atualizar totais do cliente
      try {
        const cliente = await UserEntity.get(parcelaParaAprovar.cliente_user_id);
        const novoAberto = Math.max(0, (cliente.total_em_aberto || 0) - parcelaParaAprovar.valor);
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        const vencido = new Date(parcelaParaAprovar.data_vencimento + 'T00:00:00') < hoje;
        const novoVencido = vencido ? Math.max(0, (cliente.total_vencido || 0) - parcelaParaAprovar.valor) : (cliente.total_vencido || 0);
        await UserEntity.update(parcelaParaAprovar.cliente_user_id, { total_em_aberto: novoAberto, total_vencido: novoVencido });
      } catch (e) { console.warn('Erro totais:', e); }

      // Verificar se todas as parcelas do pedido estão pagas
      try {
        const titulosDoPedido = await Carteira.filter({ pedido_id: pedido.id });
        const todosPagos = titulosDoPedido.filter(t => t.parcela_numero).every(t => t.status === 'pago' || t.id === parcelaParaAprovar.id);
        if (todosPagos && pedido.status_pagamento !== 'pago') {
          await Pedido.update(pedido.id, { status_pagamento: 'pago', data_pagamento: dataPagamentoConfirmada });
        }
        // Transição automática: pendente_pagamento → finalizado quando todas parcelas pagas
        if (todosPagos && pedido.status === 'pendente_pagamento') {
          await Pedido.update(pedido.id, { status: 'finalizado' });
        }
      } catch (e) { console.warn('Erro status pedido:', e); }

      toast.success('Comprovante aprovado!');
      setShowAprovacaoParcelaModal(false);
      setParcelaParaAprovar(null);
      setDataPagamentoConfirmada('');
      await reloadParcelas();
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao aprovar comprovante');
    } finally {
      setProcessandoAprovacao(false);
    }
  };

  // Recusar comprovante de parcela
  const handleRecusarParcela = async () => {
    if (!motivoRecusa.trim()) {
      toast.error('Informe o motivo da recusa');
      return;
    }
    setProcessandoAprovacao(true);
    try {
      await Carteira.update(parcelaParaRecusar.id, {
        comprovante_analisado: true,
        comprovante_aprovado: false,
        motivo_recusa_comprovante: motivoRecusa.trim(),
        status: 'pendente',
        comprovante_url: null,
        comprovante_data_upload: null,
        data_pagamento_informada: null
      });

      // Atualizar status_pagamento do pedido
      try {
        if (pedido.status_pagamento === 'em_analise' || pedido.status_pagamento === 'pago') {
          await Pedido.update(pedido.id, { status_pagamento: 'pendente' });
        }
        // Reversão: finalizado → pendente_pagamento quando parcela é recusada
        if (pedido.status === 'finalizado') {
          await Pedido.update(pedido.id, { status: 'pendente_pagamento' });
        }
      } catch (e) { console.warn('Erro status pedido:', e); }

      toast.success('Comprovante recusado.');
      setShowRecusaParcelaModal(false);
      setParcelaParaRecusar(null);
      setMotivoRecusa('');
      await reloadParcelas();
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao recusar comprovante');
    } finally {
      setProcessandoAprovacao(false);
    }
  };

  // Alterar status de uma parcela individual
  const handleAlterarStatusParcela = async (parcela, novoStatus, dataPagamento = null) => {
    try {
      const updateData = { status: novoStatus };

      if (novoStatus === 'pago') {
        updateData.data_pagamento = dataPagamento || new Date().toISOString().split('T')[0];
      }

      if (novoStatus === 'pendente') {
        updateData.data_pagamento = null;
      }

      await Carteira.update(parcela.id, updateData);

      // Atualizar totais do cliente ao marcar como pago
      if (novoStatus === 'pago') {
        try {
          const cliente = await UserEntity.get(parcela.cliente_user_id);
          const novoAberto = Math.max(0, (cliente.total_em_aberto || 0) - parcela.valor);
          const hoje = new Date(); hoje.setHours(0,0,0,0);
          const vencido = new Date(parcela.data_vencimento + 'T00:00:00') < hoje;
          const novoVencido = vencido ? Math.max(0, (cliente.total_vencido || 0) - parcela.valor) : (cliente.total_vencido || 0);
          await UserEntity.update(parcela.cliente_user_id, { total_em_aberto: novoAberto, total_vencido: novoVencido });
        } catch (e) { console.warn('Erro totais:', e); }
      }

      // Verificar se todas as parcelas do pedido estão pagas
      try {
        const titulosDoPedido = await Carteira.filter({ pedido_id: pedido.id });
        const parcelasReais = titulosDoPedido.filter(t => t.parcela_numero);
        const todosPagos = parcelasReais.every(t => t.status === 'pago' || (t.id === parcela.id && novoStatus === 'pago'));
        if (todosPagos && pedido.status_pagamento !== 'pago') {
          await Pedido.update(pedido.id, { status_pagamento: 'pago', data_pagamento: dataPagamento || new Date().toISOString().split('T')[0] });
        } else if (!todosPagos && pedido.status_pagamento === 'pago') {
          await Pedido.update(pedido.id, { status_pagamento: 'pendente' });
        }

        // Transição automática: pendente_pagamento → finalizado quando todas parcelas pagas
        if (todosPagos && pedido.status === 'pendente_pagamento') {
          await Pedido.update(pedido.id, { status: 'finalizado' });
        }
        // Reversão: finalizado → pendente_pagamento quando parcela volta a pendente
        if (!todosPagos && pedido.status === 'finalizado') {
          await Pedido.update(pedido.id, { status: 'pendente_pagamento' });
        }
      } catch (e) { console.warn('Erro status pedido:', e); }

      toast.success('Status da parcela atualizado!');
      await reloadParcelas();
      onUpdate();
    } catch (_error) {
      toast.error('Erro ao atualizar status da parcela');
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
          Vencimento: ${new Date(parcelaSelecionada.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
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

              {pedido.observacoes_fornecedor && !isCliente && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Observações Internas (Fornecedor):</h4>
                  <p className="text-gray-700">{pedido.observacoes_fornecedor}</p>
                </div>
              )}
            </TabsContent>

            {/* Tab: Entrega */}
            <TabsContent value="entrega" className="space-y-4">
              {lojaInfo && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-800">Loja de Destino</h4>
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p className="font-medium">{lojaInfo.nome_fantasia || lojaInfo.nome}</p>
                    {lojaInfo.cnpj && <p><strong>CNPJ:</strong> {lojaInfo.cnpj}</p>}
                    {lojaInfo.codigo_cliente && <p><strong>Código:</strong> {lojaInfo.codigo_cliente}</p>}
                    {lojaInfo.endereco_completo && <p>{lojaInfo.endereco_completo}</p>}
                    {(lojaInfo.cidade || lojaInfo.estado) && <p>{lojaInfo.cidade}{lojaInfo.estado ? `/${lojaInfo.estado}` : ''} {lojaInfo.cep ? `- CEP: ${lojaInfo.cep}` : ''}</p>}
                    {lojaInfo.telefone && <p><strong>Tel:</strong> {lojaInfo.telefone}</p>}
                  </div>
                </div>
              )}
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
                    <span>{new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}

              {/* Frete FOB */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-orange-600" />
                  <h4 className="font-semibold">Frete FOB</h4>
                </div>
                {canUpload ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="valorFreteFOB">Valor do Frete FOB</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">R$</span>
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
                      <p className="text-xs text-gray-500 mt-1">
                        Frete por conta do comprador (FOB)
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Valor dos Produtos:</span>
                        <span>R$ {(pedido.valor_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Frete FOB:</span>
                        <span>R$ {(parseFloat(valorFreteFOB) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Valor Total:</span>
                        <span className="text-green-600">
                          R$ {((pedido.valor_total || 0) + (parseFloat(valorFreteFOB) || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSalvarFrete}
                      disabled={salvandoFrete}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {salvandoFrete ? 'Salvando...' : 'Salvar Frete'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pedido.valor_frete_fob > 0 ? (
                      <div className="bg-white p-3 rounded-lg border border-orange-200">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Valor dos Produtos:</span>
                          <span>R$ {(pedido.valor_total || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Frete FOB:</span>
                          <span>R$ {(pedido.valor_frete_fob || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t">
                          <span>Valor Total:</span>
                          <span className="text-green-600">
                            R$ {(pedido.valor_final || pedido.valor_total || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Frete não informado</p>
                    )}
                  </div>
                )}
              </div>

              {pedido.transportadora && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-5 h-5 text-orange-600" />
                    <h4 className="font-semibold">Informações de Transporte:</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <p className="text-gray-700">Transportadora: <strong>{pedido.transportadora}</strong></p>
                    {pedido.data_envio_real && (
                      <p className="text-gray-700">Data de Envio: <strong>{new Date(pedido.data_envio_real + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></p>
                    )}
                    {pedido.tipo_frete && (
                      <p className="text-gray-700">Tipo de Frete: <strong>{pedido.tipo_frete === 'FOB' ? 'FOB (cliente)' : 'CIF (fornecedor)'}</strong></p>
                    )}
                    {pedido.tipo_frete === 'FOB' && pedido.valor_frete_fob > 0 && (
                      <p className="text-gray-700">Valor do Frete: <strong>R$ {Number(pedido.valor_frete_fob).toFixed(2).replace('.', ',')}</strong>
                        {pedido.frete_incluso_boleto && <span className="text-xs text-blue-600 ml-1">(incluso no boleto)</span>}
                      </p>
                    )}
                  </div>
                  {pedido.codigo_rastreio && (
                    <div className="mt-2">
                      <p className="text-gray-700 text-sm">Código de Rastreio: <strong>{pedido.codigo_rastreio}</strong></p>
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

              {/* Marcar Entregue (fornecedor/admin) */}
              {canUpload && pedido.status === 'em_transporte' && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-green-900 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Marcar como Entregue
                      </h4>
                      <p className="text-sm text-green-700 mt-1">
                        Confirme que o pedido foi entregue ao cliente
                      </p>
                    </div>
                    <Button
                      onClick={handleMarcarEntregue}
                      disabled={marcandoEntregue}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {marcandoEntregue ? 'Processando...' : 'Marcar Entregue'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Confirmações do cliente */}
              {(pedido.status === 'faturado' || pedido.status === 'em_transporte' || pedido.status === 'pendente_pagamento' || pedido.status === 'finalizado') && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-3">Confirmações de Recebimento</h4>
                  <div className="space-y-2">
                    {/* NF */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Nota Fiscal:</span>
                      {pedido.cliente_confirmou_nf ? (
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Confirmado {pedido.data_confirmacao_nf ? `em ${new Date(pedido.data_confirmacao_nf + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">Pendente</span>
                      )}
                    </div>
                    {/* Boleto */}
                    {pedido.boleto_url && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Boleto:</span>
                        {pedido.cliente_confirmou_boleto ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Confirmado {pedido.data_confirmacao_boleto ? `em ${new Date(pedido.data_confirmacao_boleto + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">Pendente</span>
                        )}
                      </div>
                    )}
                    {/* Produto */}
                    {(pedido.status === 'em_transporte' || pedido.status === 'pendente_pagamento' || pedido.status === 'finalizado') && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Produto:</span>
                        {pedido.cliente_confirmou_recebimento ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Confirmado {pedido.data_confirmacao_recebimento ? `em ${new Date(pedido.data_confirmacao_recebimento + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                          </span>
                        ) : !isCliente ? (
                          <span className="text-yellow-600">Aguardando cliente</span>
                        ) : (
                          <span className="text-blue-600">Aguardando recebimento</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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
                    <span>{new Date(pedido.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
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
                                  <span className="ml-2">{new Date(parcela.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                                {parcela.data_pagamento && (
                                  <div>
                                    <span className="text-gray-500">Pago em:</span>
                                    <span className="ml-2 text-green-600 font-medium">{new Date(parcela.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
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

                            {/* Botões de ação */}
                            <div className="flex flex-wrap gap-2 items-center">
                              {/* Fornecedor/Admin: alterar status da parcela */}
                              {!isCliente && (
                                <Select
                                  value={parcela.status || 'pendente'}
                                  onValueChange={(value) => {
                                    if (value === 'pago') {
                                      setParcelaParaMarcarPago(parcela);
                                      setDataPagamentoManual(new Date().toISOString().split('T')[0]);
                                      setShowConfirmarPagoModal(true);
                                    } else {
                                      handleAlterarStatusParcela(parcela, value);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[160px] h-8 text-xs">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="em_analise">Em Análise</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}

                              {/* Cliente: enviar comprovante */}
                              {isCliente && parcela.status === 'pendente' && !parcela.comprovante_url && (
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

                              {/* Cliente: reenviar comprovante se foi recusado */}
                              {isCliente && parcela.comprovante_analisado &&
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

                              {/* Fornecedor/Admin: aprovar/recusar comprovante em_analise */}
                              {!isCliente && parcela.status === 'em_analise' && parcela.comprovante_url && (
                                <>
                                  <Button
                                    onClick={() => {
                                      setParcelaParaAprovar(parcela);
                                      setDataPagamentoConfirmada(parcela.data_pagamento_informada || new Date().toISOString().split('T')[0]);
                                      setShowAprovacaoParcelaModal(true);
                                    }}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setParcelaParaRecusar(parcela);
                                      setMotivoRecusa('');
                                      setShowRecusaParcelaModal(true);
                                    }}
                                    size="sm"
                                    variant="destructive"
                                  >
                                    <AlertTriangle className="w-4 h-4 mr-1" />
                                    Recusar
                                  </Button>
                                </>
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

                    {/* Botão Atualizar Boleto na aba Pagamento */}
                    {canUpload && !showEditBoleto && !todasParcelasPagas && (
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenEditBoleto}
                          className="w-full text-blue-700 border-blue-300 hover:bg-blue-100"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar / Adicionar Parcelas
                        </Button>
                      </div>
                    )}
                    {canUpload && todasParcelasPagas && (
                      <div className="mt-4">
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Todas as parcelas pagas - nao editavel
                        </Badge>
                      </div>
                    )}

                    {/* Formulário de edição de parcelas inline na aba Pagamento */}
                    {canUpload && showEditBoleto && (() => {
                      const valorTotal = pedido.valor_final || pedido.valor_total || 0;
                      const valorPago = parcelasBoletoConfig.filter(p => p.isPago).reduce((s, p) => s + (p.valor || 0), 0);
                      const valorRestante = valorTotal - valorPago;
                      const qtdEditaveis = parcelasBoletoConfig.filter(p => !p.isPago).length;
                      const valorPorParcela = qtdEditaveis > 0 ? valorRestante / qtdEditaveis : 0;
                      const parcelasPagasCount = parcelasBoletoConfig.filter(p => p.isPago).length;

                      return (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-blue-800">Editar Parcelas:</p>
                          <Button variant="ghost" size="sm" onClick={() => setShowEditBoleto(false)} className="text-xs text-gray-500">
                            <ChevronUp className="w-4 h-4 mr-1" /> Fechar
                          </Button>
                        </div>

                        <div className="bg-white/60 p-3 rounded-lg space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Quantidade de Parcelas</Label>
                              <Select value={String(qtdParcelasBoleto)} onValueChange={handleQtdParcelasEditChange}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                    <SelectItem key={n} value={String(n)} disabled={n < parcelasPagasCount}>{n}x</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <div className="text-xs text-blue-800 space-y-0.5">
                                <p><strong>Valor total:</strong> {formatCurrency(valorTotal)}</p>
                                {valorPago > 0 && <p className="text-green-700"><strong>Ja pago:</strong> {formatCurrency(valorPago)}</p>}
                                {qtdEditaveis > 0 && <p><strong>Por parcela:</strong> {formatCurrency(valorPorParcela)}</p>}
                              </div>
                            </div>
                          </div>

                          {temParcelaPaga && (
                            <Badge className="bg-amber-100 text-amber-800 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Parcelas pagas nao editaveis
                            </Badge>
                          )}

                          <div className="space-y-2">
                            <Label className="text-xs">Datas de Vencimento</Label>
                            {parcelasBoletoConfig.map((parcela, index) => (
                              <div key={index} className={`flex items-center gap-2 p-2 rounded border ${parcela.isPago ? 'bg-green-50 border-green-200' : 'bg-white border-blue-200'}`}>
                                <Badge variant="outline" className="text-xs shrink-0">{index + 1}/{qtdParcelasBoleto}</Badge>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {formatCurrency(parcela.isPago ? (parcela.valor || 0) : valorPorParcela)}
                                </span>
                                {parcela.isPago ? (
                                  <>
                                    <span className="text-sm text-gray-600 flex-1">
                                      {parcela.dataVencimento ? new Date(parcela.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                    </span>
                                    <Badge className="bg-green-100 text-green-800 text-xs shrink-0">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Pago
                                    </Badge>
                                  </>
                                ) : (
                                  <Input
                                    type="date"
                                    value={parcela.dataVencimento}
                                    onChange={(e) => handleParcelaBoletoDataChange(index, e.target.value)}
                                    className="h-8 text-sm"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Novo arquivo do boleto (opcional)</Label>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.crm"
                            onChange={(e) => setBoletoFile(e.target.files[0])}
                          />
                          <p className="text-xs text-gray-500 mt-1">Deixe em branco para manter o arquivo atual</p>
                        </div>
                        <Button
                          onClick={handleEditBoleto}
                          disabled={uploading}
                          size="sm"
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          {uploading ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                      </div>
                      );
                    })()}
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
                        O cliente enviou o comprovante. Verifique e altere o status para &quot;Pago&quot; se estiver correto.
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
                      {!pedido.cliente_confirmou_boleto && !isCliente && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Aguardando confirmação
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Permitir atualizar o boleto se for fornecedor/admin e nem todas parcelas pagas */}
                  {canUpload && !showEditBoleto && !todasParcelasPagas && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenEditBoleto}
                        className="w-full text-blue-700 border-blue-300 hover:bg-blue-100"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Atualizar Boleto
                      </Button>
                    </div>
                  )}
                  {canUpload && todasParcelasPagas && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Todas as parcelas pagas - boleto não editável
                      </Badge>
                    </div>
                  )}
                  {canUpload && showEditBoleto && (() => {
                    const valorTotal = pedido.valor_final || pedido.valor_total || 0;
                    const valorPago = parcelasBoletoConfig.filter(p => p.isPago).reduce((s, p) => s + (p.valor || 0), 0);
                    const valorRestante = valorTotal - valorPago;
                    const qtdEditaveis = parcelasBoletoConfig.filter(p => !p.isPago).length;
                    const valorPorParcela = qtdEditaveis > 0 ? valorRestante / qtdEditaveis : 0;
                    const parcelasPagasCount = parcelasBoletoConfig.filter(p => p.isPago).length;

                    return (
                    <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-blue-800">Editar Boleto:</p>
                        <Button variant="ghost" size="sm" onClick={() => setShowEditBoleto(false)} className="text-xs text-gray-500">
                          <ChevronUp className="w-4 h-4 mr-1" /> Fechar
                        </Button>
                      </div>

                      <div className="bg-blue-100/50 p-3 rounded-lg space-y-3">
                        {/* Seletor de quantidade + resumo de valores */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Quantidade de Parcelas</Label>
                            <Select value={String(qtdParcelasBoleto)} onValueChange={handleQtdParcelasEditChange}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                  <SelectItem key={n} value={String(n)} disabled={n < parcelasPagasCount}>{n}x</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <div className="text-xs text-blue-800 space-y-0.5">
                              <p><strong>Valor total:</strong> {formatCurrency(valorTotal)}</p>
                              {valorPago > 0 && <p className="text-green-700"><strong>Ja pago:</strong> {formatCurrency(valorPago)}</p>}
                              {qtdEditaveis > 0 && <p><strong>Por parcela:</strong> {formatCurrency(valorPorParcela)}</p>}
                            </div>
                          </div>
                        </div>

                        {temParcelaPaga && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Parcelas pagas nao editaveis
                          </Badge>
                        )}

                        {/* Datas de vencimento */}
                        <div className="space-y-2">
                          <Label className="text-xs">Datas de Vencimento</Label>
                          {parcelasBoletoConfig.map((parcela, index) => (
                            <div key={index} className={`flex items-center gap-2 p-2 rounded border ${parcela.isPago ? 'bg-green-50 border-green-200' : 'bg-white border-blue-200'}`}>
                              <Badge variant="outline" className="text-xs shrink-0">{index + 1}/{qtdParcelasBoleto}</Badge>
                              <span className="text-xs text-gray-500 shrink-0">
                                {formatCurrency(parcela.isPago ? (parcela.valor || 0) : valorPorParcela)}
                              </span>
                              {parcela.isPago ? (
                                <>
                                  <span className="text-sm text-gray-600 flex-1">
                                    {parcela.dataVencimento ? new Date(parcela.dataVencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                  </span>
                                  <Badge className="bg-green-100 text-green-800 text-xs shrink-0">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Pago
                                  </Badge>
                                </>
                              ) : (
                                <Input
                                  type="date"
                                  value={parcela.dataVencimento}
                                  onChange={(e) => handleParcelaBoletoDataChange(index, e.target.value)}
                                  className="h-8 text-sm"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Novo arquivo do boleto (opcional)</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.crm"
                          onChange={(e) => setBoletoFile(e.target.files[0])}
                        />
                        <p className="text-xs text-gray-500 mt-1">Deixe em branco para manter o arquivo atual</p>
                      </div>
                      <Button
                        onClick={handleEditBoleto}
                        disabled={uploading}
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        {uploading ? 'Salvando...' : 'Salvar Alterações'}
                      </Button>
                    </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h4 className="font-semibold text-gray-600">Boleto</h4>
                  </div>
                  {canUpload ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">Nenhum boleto anexado. Configure as parcelas e faça o upload:</p>

                      {/* Configuração de Parcelas */}
                      <div className="bg-blue-50 p-3 rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Quantidade de Parcelas</Label>
                            <Select value={String(qtdParcelasBoleto)} onValueChange={handleQtdParcelasBoletoChange}>
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
                              <p><strong>Valor total:</strong> {formatCurrency(pedido.valor_final || pedido.valor_total)}</p>
                              <p><strong>Por parcela:</strong> {formatCurrency((pedido.valor_final || pedido.valor_total) / qtdParcelasBoleto)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Datas de Vencimento *</Label>
                          {parcelasBoletoConfig.map((parcela, index) => (
                            <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-blue-200">
                              <Badge variant="outline" className="text-xs shrink-0">{index + 1}/{qtdParcelasBoleto}</Badge>
                              <span className="text-xs text-gray-500 shrink-0">{formatCurrency((pedido.valor_final || pedido.valor_total) / qtdParcelasBoleto)}</span>
                              <Input
                                type="date"
                                value={parcela.dataVencimento}
                                onChange={(e) => handleParcelaBoletoDataChange(index, e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Arquivo do Boleto *</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.crm"
                          onChange={(e) => setBoletoFile(e.target.files[0])}
                        />
                        <p className="text-xs text-gray-500 mt-1"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                      </div>
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
                      {!pedido.cliente_confirmou_nf && !isCliente && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Clock className="w-3 h-3 mr-1" />
                          Aguardando confirmação
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Permitir atualizar a NF se for fornecedor/admin */}
                  {canUpload && !showEditNF && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEditNF(true)}
                        className="w-full text-green-700 border-green-300 hover:bg-green-100"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Atualizar Nota Fiscal
                      </Button>
                    </div>
                  )}
                  {canUpload && showEditNF && (
                    <div className="mt-4 pt-4 border-t border-green-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-green-800">Atualizar Nota Fiscal:</p>
                        <Button variant="ghost" size="sm" onClick={() => setShowEditNF(false)} className="text-xs text-gray-500">
                          <ChevronUp className="w-4 h-4 mr-1" /> Fechar
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs" htmlFor="nfNumeroUpdate">Número da NF *</Label>
                          <Input
                            id="nfNumeroUpdate"
                            type="text"
                            placeholder="Ex: 12345"
                            value={nfNumero}
                            onChange={(e) => setNfNumero(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs" htmlFor="nfDataEmissaoUpdate">Data de Emissão</Label>
                          <Input
                            id="nfDataEmissaoUpdate"
                            type="date"
                            value={nfDataEmissao}
                            onChange={(e) => setNfDataEmissao(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Arquivo da NF *</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.crm"
                          onChange={(e) => setNfFile(e.target.files[0])}
                        />
                        <p className="text-xs text-gray-500 mt-1"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                      </div>
                      <Button
                        onClick={handleUploadNF}
                        disabled={uploading || !nfFile || !nfNumero}
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? 'Enviando...' : 'Atualizar Nota Fiscal'}
                      </Button>
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
                      <p className="text-sm text-gray-500">Nenhuma NF anexada. Preencha os dados e faça o upload:</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="nfNumeroModal" className="text-xs">Número da NF *</Label>
                          <Input
                            id="nfNumeroModal"
                            type="text"
                            placeholder="Ex: 12345"
                            value={nfNumero}
                            onChange={(e) => setNfNumero(e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor="nfDataEmissaoModal" className="text-xs">Data de Emissão</Label>
                          <Input
                            id="nfDataEmissaoModal"
                            type="date"
                            value={nfDataEmissao}
                            onChange={(e) => setNfDataEmissao(e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Arquivo da NF *</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.crm"
                          onChange={(e) => setNfFile(e.target.files[0])}
                        />
                        <p className="text-xs text-gray-500 mt-1"><strong>Formatos aceitos:</strong> PDF, JPG, PNG, CRM</p>
                      </div>
                      <Button
                        onClick={handleUploadNF}
                        disabled={uploading || !nfFile || !nfNumero}
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
                        Vencimento: {new Date(parcelaSelecionada.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
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

      {/* Modal de Aprovação de Comprovante por Parcela */}
      {showAprovacaoParcelaModal && parcelaParaAprovar && (
        <Dialog open={showAprovacaoParcelaModal} onOpenChange={setShowAprovacaoParcelaModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Aprovar Comprovante
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Parcela:</span>
                  <span className="font-medium">{parcelaParaAprovar.parcela_numero} de {parcelaParaAprovar.total_parcelas}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className="font-bold">R$ {parcelaParaAprovar.valor?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Vencimento:</span>
                  <span>{new Date(parcelaParaAprovar.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
                {parcelaParaAprovar.data_pagamento_informada && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span className="text-sm">Data informada pelo cliente:</span>
                    <span>{new Date(parcelaParaAprovar.data_pagamento_informada + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {parcelaParaAprovar.comprovante_url && (
                  <div className="mt-3 pt-3 border-t">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(parcelaParaAprovar.comprovante_url, '_blank')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Visualizar Comprovante
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label>Data do Pagamento Confirmada *</Label>
                <Input
                  type="date"
                  value={dataPagamentoConfirmada}
                  onChange={(e) => setDataPagamentoConfirmada(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setShowAprovacaoParcelaModal(false); setParcelaParaAprovar(null); }} disabled={processandoAprovacao}>
                  Cancelar
                </Button>
                <Button onClick={handleAprovarParcela} disabled={!dataPagamentoConfirmada || processandoAprovacao} className="bg-green-600 hover:bg-green-700">
                  {processandoAprovacao ? 'Processando...' : 'Confirmar Aprovação'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Recusa de Comprovante por Parcela */}
      {showRecusaParcelaModal && parcelaParaRecusar && (
        <Dialog open={showRecusaParcelaModal} onOpenChange={setShowRecusaParcelaModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Recusar Comprovante
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Parcela:</span>
                  <span className="font-medium">{parcelaParaRecusar.parcela_numero} de {parcelaParaRecusar.total_parcelas}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Valor:</span>
                  <span className="font-bold">R$ {parcelaParaRecusar.valor?.toFixed(2)}</span>
                </div>
                {parcelaParaRecusar.comprovante_url && (
                  <div className="mt-3 pt-3 border-t">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(parcelaParaRecusar.comprovante_url, '_blank')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Visualizar Comprovante
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label>Motivo da Recusa *</Label>
                <Input
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Ex: valor incorreto, comprovante ilegível..."
                  className="mt-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setShowRecusaParcelaModal(false); setParcelaParaRecusar(null); }} disabled={processandoAprovacao}>
                  Cancelar
                </Button>
                <Button onClick={handleRecusarParcela} disabled={!motivoRecusa.trim() || processandoAprovacao} variant="destructive">
                  {processandoAprovacao ? 'Processando...' : 'Confirmar Recusa'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Modal: Confirmar data de pagamento ao marcar parcela como Pago */}
      {showConfirmarPagoModal && parcelaParaMarcarPago && (
        <Dialog open={showConfirmarPagoModal} onOpenChange={(open) => {
          if (!open) {
            setShowConfirmarPagoModal(false);
            setParcelaParaMarcarPago(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Confirmar Pagamento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-green-50 p-3 rounded-lg text-sm">
                <p className="text-gray-700">
                  Parcela {parcelaParaMarcarPago.parcela_numero}/{parcelaParaMarcarPago.total_parcelas} -
                  <strong> {formatCurrency(parcelaParaMarcarPago.valor)}</strong>
                </p>
                {parcelaParaMarcarPago.data_vencimento && (
                  <p className="text-gray-500 text-xs mt-1">
                    Vencimento: {new Date(parcelaParaMarcarPago.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="dataPagamentoManual">Data do Pagamento *</Label>
                <Input
                  id="dataPagamentoManual"
                  type="date"
                  value={dataPagamentoManual}
                  onChange={(e) => setDataPagamentoManual(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setShowConfirmarPagoModal(false); setParcelaParaMarcarPago(null); }}>
                  Cancelar
                </Button>
                <Button
                  disabled={!dataPagamentoManual}
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    await handleAlterarStatusParcela(parcelaParaMarcarPago, 'pago', dataPagamentoManual);
                    setShowConfirmarPagoModal(false);
                    setParcelaParaMarcarPago(null);
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}