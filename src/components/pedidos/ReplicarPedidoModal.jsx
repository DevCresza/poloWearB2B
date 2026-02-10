import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/exportUtils';
import {
  Store, Check, Minus, Plus, Trash2, AlertTriangle,
  CheckCircle, XCircle, Loader2, CreditCard, ArrowRight, ArrowLeft
} from 'lucide-react';

// Stepper visual
function Stepper({ currentStep }) {
  const steps = [
    { num: 1, label: 'Selecionar Lojas' },
    { num: 2, label: 'Validar Pedidos' },
    { num: 3, label: 'Confirmar' }
  ];
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
            currentStep === s.num
              ? 'bg-blue-600 text-white'
              : currentStep > s.num
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
          }`}>
            {currentStep > s.num ? <Check className="w-4 h-4" /> : s.num}
          </div>
          <span className={`ml-1.5 text-xs font-medium hidden sm:inline ${
            currentStep >= s.num ? 'text-gray-900' : 'text-gray-400'
          }`}>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-2 ${
              currentStep > s.num ? 'bg-green-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ReplicarPedidoModal({
  open,
  onOpenChange,
  grupo,
  lojas,
  preSelectedLojaIds: preSelectedProp,
  fornecedores,
  criarPedidoParaLoja,
  getMetodosPagamentoDisponiveis,
  onSuccess
}) {
  const initialIds = () => {
    if (preSelectedProp && preSelectedProp.length > 0) return new Set(preSelectedProp);
    return new Set();
  };

  const [step, setStep] = useState(1);
  const [selectedLojaIds, setSelectedLojaIds] = useState(initialIds);
  const [pedidosConfig, setPedidosConfig] = useState({});
  const [processando, setProcessando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [progressAtual, setProgressAtual] = useState(0);

  const fornecedor = fornecedores.find(f => f.id === grupo.fornecedor_id);
  const fornecedorNome = fornecedor?.nome_marca || fornecedor?.nome_fantasia || 'Fornecedor';
  const valorMinimo = fornecedor?.pedido_minimo_valor || 0;
  const metodosPagamento = getMetodosPagamentoDisponiveis(grupo.fornecedor_id);

  const outrasLojas = useMemo(() =>
    lojas.filter(l => l.ativa !== false),
    [lojas]
  );

  const lojasDisponiveis = useMemo(() =>
    outrasLojas.filter(l => !l.bloqueada),
    [outrasLojas]
  );

  // Reset state when modal opens/closes
  const handleOpenChange = (isOpen) => {
    // Bloquear fechamento durante processamento
    if (!isOpen && processando) return;

    if (!isOpen) {
      // Capturar se houve sucesso ANTES de resetar estado
      const hadSuccess = resultados.some(r => r.success);

      setStep(1);
      setSelectedLojaIds(initialIds());
      setPedidosConfig({});
      setProcessando(false);
      setResultados([]);
      setProgressAtual(0);

      onOpenChange(false);

      // Limpar carrinho somente ao fechar o modal (após user ver resultados)
      if (hadSuccess) {
        onSuccess(grupo.fornecedor_id);
      }
      return;
    }
    onOpenChange(isOpen);
  };

  // --- STEP 1: Selecionar Lojas ---
  const toggleLoja = (lojaId) => {
    // Lojas bloqueadas não podem ser selecionadas
    const loja = outrasLojas.find(l => l.id === lojaId);
    if (loja?.bloqueada) return;
    setSelectedLojaIds(prev => {
      const next = new Set(prev);
      if (next.has(lojaId)) {
        next.delete(lojaId);
      } else {
        next.add(lojaId);
      }
      return next;
    });
  };

  const selecionarTodas = () => {
    setSelectedLojaIds(new Set(lojasDisponiveis.map(l => l.id)));
  };

  const desmarcarTodas = () => {
    setSelectedLojaIds(new Set());
  };

  const todasSelecionadas = lojasDisponiveis.length > 0 && lojasDisponiveis.every(l => selectedLojaIds.has(l.id));

  const avancarParaStep2 = () => {
    // Inicializar config para cada loja
    const config = {};
    selectedLojaIds.forEach(lojaId => {
      config[lojaId] = {
        itens: grupo.itens.map(item => ({ ...item })), // cópia independente
        metodo: '',
        obs: ''
      };
    });
    setPedidosConfig(config);
    setStep(2);
  };

  // --- STEP 2: Validar e Editar ---
  const updateItemQuantidade = (lojaId, itemIndex, novaQtd) => {
    if (novaQtd < 0) return;
    setPedidosConfig(prev => {
      const next = { ...prev };
      const lojaConfig = { ...next[lojaId] };
      const itens = [...lojaConfig.itens];
      if (novaQtd === 0) {
        itens.splice(itemIndex, 1);
      } else {
        itens[itemIndex] = { ...itens[itemIndex], quantidade: novaQtd };
      }
      lojaConfig.itens = itens;
      next[lojaId] = lojaConfig;
      return next;
    });
  };

  const removeItem = (lojaId, itemIndex) => {
    setPedidosConfig(prev => {
      const next = { ...prev };
      const lojaConfig = { ...next[lojaId] };
      const itens = [...lojaConfig.itens];
      itens.splice(itemIndex, 1);
      lojaConfig.itens = itens;
      next[lojaId] = lojaConfig;
      return next;
    });
  };

  const updateMetodo = (lojaId, metodo) => {
    setPedidosConfig(prev => ({
      ...prev,
      [lojaId]: { ...prev[lojaId], metodo }
    }));
  };

  const updateObs = (lojaId, obs) => {
    setPedidosConfig(prev => ({
      ...prev,
      [lojaId]: { ...prev[lojaId], obs }
    }));
  };

  const calcularTotalLoja = (lojaId) => {
    const config = pedidosConfig[lojaId];
    if (!config) return 0;
    return config.itens.reduce((sum, item) => {
      const preco = item.tipo === 'capsula'
        ? (item.preco_unitario || 0)
        : (item.tipo_venda === 'grade' ? item.preco_grade_completa : item.preco_por_peca);
      return sum + preco * item.quantidade;
    }, 0);
  };

  const enderecoCompleto = (loja) => {
    return loja.endereco_completo && loja.cep && loja.cidade && loja.estado;
  };

  const validarStep2 = () => {
    for (const lojaId of selectedLojaIds) {
      const config = pedidosConfig[lojaId];
      if (!config) return false;
      if (config.itens.length === 0) return false;
      if (!config.metodo) return false;
      const loja = outrasLojas.find(l => l.id === lojaId);
      if (!loja || !enderecoCompleto(loja)) return false;
      if (valorMinimo > 0 && calcularTotalLoja(lojaId) < valorMinimo) return false;
    }
    return true;
  };

  // --- STEP 3: Confirmar e Processar ---
  const totalGeral = useMemo(() => {
    return Array.from(selectedLojaIds).reduce((sum, lojaId) => sum + calcularTotalLoja(lojaId), 0);
  }, [selectedLojaIds, pedidosConfig]);

  const processarPedidos = async () => {
    setProcessando(true);
    setResultados([]);
    setProgressAtual(0);

    const lojaIds = Array.from(selectedLojaIds);
    const results = [];

    for (let i = 0; i < lojaIds.length; i++) {
      const lojaId = lojaIds[i];
      const loja = outrasLojas.find(l => l.id === lojaId);
      const config = pedidosConfig[lojaId];

      // Construir grupoData com itens editados
      const grupoData = {
        fornecedor_id: grupo.fornecedor_id,
        itens: config.itens,
        total: calcularTotalLoja(lojaId),
        temCapsula: config.itens.some(it => it.tipo === 'capsula')
      };

      try {
        const result = await criarPedidoParaLoja(grupoData, loja, config.metodo, config.obs);
        results.push({
          lojaId,
          lojaNome: loja?.nome_fantasia || loja?.nome || 'Loja',
          ...result
        });
      } catch (err) {
        results.push({
          lojaId,
          lojaNome: loja?.nome_fantasia || loja?.nome || 'Loja',
          success: false,
          error: err.message || 'Erro desconhecido'
        });
      }

      setProgressAtual(i + 1);
      setResultados([...results]);
    }

    // Resultado final - toasts (limpeza do carrinho acontece ao fechar o modal)
    const sucessos = results.filter(r => r.success).length;
    const falhas = results.filter(r => !r.success).length;

    if (sucessos > 0 && falhas === 0) {
      toast.success(`${sucessos} pedido(s) criado(s) com sucesso para ${fornecedorNome}!`);
    } else if (sucessos > 0 && falhas > 0) {
      toast.warning(`${sucessos} pedido(s) criado(s), ${falhas} falha(s). Verifique os resultados.`);
    } else {
      toast.error('Nenhum pedido foi criado. Verifique os resultados.');
    }

    setProcessando(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Store className="w-5 h-5 text-blue-600" />
            Finalizar Pedido para Múltiplas Lojas
          </DialogTitle>
        </DialogHeader>

        <Stepper currentStep={step} />

        {/* Badge info do pedido base */}
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 text-sm mb-2">
          <Store className="w-4 h-4 text-blue-600" />
          <span>Pedido base: <strong>{fornecedorNome}</strong> - <strong>{formatCurrency(grupo.total)}</strong></span>
          <Badge variant="outline" className="ml-auto">{grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}</Badge>
        </div>

        <ScrollArea className="flex-1 overflow-auto pr-2">
          {/* STEP 1: Selecionar Lojas */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Selecione as lojas que receberão este pedido:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={todasSelecionadas ? desmarcarTodas : selecionarTodas}
                  className="text-xs"
                >
                  {todasSelecionadas ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </Button>
              </div>

              <div className="space-y-2">
                {outrasLojas.map(loja => {
                  const isSelected = selectedLojaIds.has(loja.id);
                  const temEndereco = enderecoCompleto(loja);
                  const isBloqueada = loja.bloqueada === true;

                  return (
                    <div
                      key={loja.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isBloqueada
                          ? 'border-red-200 bg-red-50 opacity-70 cursor-not-allowed'
                          : isSelected
                            ? 'border-blue-300 bg-blue-50 cursor-pointer'
                            : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={() => !isBloqueada && toggleLoja(loja.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isBloqueada}
                        className="pointer-events-none"
                      />
                      <Store className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {loja.nome_fantasia || loja.nome}
                          </span>
                          {isBloqueada && (
                            <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">Bloqueada</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {loja.cidade ? `${loja.cidade}/${loja.estado}` : 'Sem cidade'}
                          {loja.cnpj ? ` - CNPJ: ${loja.cnpj}` : ''}
                        </p>
                      </div>
                      {!temEndereco && !isBloqueada && (
                        <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50 text-[10px] flex-shrink-0">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Sem endereço
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedLojaIds.size < 1 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-sm">
                    Selecione ao menos 1 loja para finalizar o pedido.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* STEP 2: Validar e Editar por Loja */}
          {step === 2 && (
            <div className="space-y-2">
              <Accordion type="multiple" defaultValue={Array.from(selectedLojaIds)} className="space-y-2">
                {Array.from(selectedLojaIds).map(lojaId => {
                  const loja = outrasLojas.find(l => l.id === lojaId);
                  if (!loja) return null;
                  const config = pedidosConfig[lojaId];
                  if (!config) return null;
                  const totalLoja = calcularTotalLoja(lojaId);
                  const temEndereco = enderecoCompleto(loja);
                  const abaixoMinimo = valorMinimo > 0 && totalLoja < valorMinimo;

                  return (
                    <AccordionItem key={lojaId} value={lojaId} className="border rounded-lg px-3">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <Store className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{loja.nome_fantasia || loja.nome}</span>
                          <span className="ml-auto text-sm font-bold text-green-600 flex-shrink-0 mr-2">
                            {formatCurrency(totalLoja)}
                          </span>
                          {!temEndereco && <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                          {abaixoMinimo && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-1">
                          {/* Endereço */}
                          <div className="text-xs bg-gray-50 p-2 rounded">
                            <span className="font-medium text-gray-700">Entrega: </span>
                            {temEndereco ? (
                              <span className="text-gray-600">
                                {loja.endereco_completo}, {loja.cidade}/{loja.estado} - CEP {loja.cep}
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">
                                Endereço incompleto - cadastre em Meu Perfil {'>'} Minhas Lojas
                              </span>
                            )}
                          </div>

                          {!temEndereco && (
                            <Alert className="border-red-200 bg-red-50">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <AlertDescription className="text-red-700 text-xs">
                                Esta loja não possui endereço completo. Não será possível criar o pedido.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Itens */}
                          <div className="space-y-2">
                            {config.itens.map((item, idx) => {
                              const preco = item.tipo === 'capsula'
                                ? (item.preco_unitario || 0)
                                : (item.tipo_venda === 'grade' ? item.preco_grade_completa : item.preco_por_peca);
                              return (
                                <div key={idx} className="flex items-center gap-2 bg-white border rounded p-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {item.tipo === 'capsula' && <Badge className="bg-purple-600 text-white text-[8px] mr-1 px-1 py-0">CAPS</Badge>}
                                      {item.nome}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                      {formatCurrency(preco)} {item.cor_selecionada?.cor_nome ? `- ${item.cor_selecionada.cor_nome}` : ''}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => updateItemQuantidade(lojaId, idx, item.quantidade - 1)}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <span className="w-8 text-center text-xs font-semibold">{item.quantidade}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => updateItemQuantidade(lojaId, idx, item.quantidade + 1)}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <span className="text-xs font-bold text-green-600 w-20 text-right">
                                    {formatCurrency(preco * item.quantidade)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => removeItem(lojaId, idx)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}

                            {config.itens.length === 0 && (
                              <p className="text-xs text-red-600 text-center py-2">Nenhum item. Remova esta loja ou adicione itens.</p>
                            )}
                          </div>

                          {/* Pedido mínimo */}
                          {abaixoMinimo && (
                            <Alert className="border-yellow-200 bg-yellow-50">
                              <AlertTriangle className="h-3 w-3 text-yellow-600" />
                              <AlertDescription className="text-yellow-800 text-xs">
                                Abaixo do mínimo de {formatCurrency(valorMinimo)}. Faltam {formatCurrency(valorMinimo - totalLoja)}.
                              </AlertDescription>
                            </Alert>
                          )}

                          {/* Pagamento */}
                          <div>
                            <Label className="flex items-center gap-1 mb-1 text-xs">
                              <CreditCard className="w-3 h-3" /> Pagamento *
                            </Label>
                            <Select
                              value={config.metodo}
                              onValueChange={(v) => updateMetodo(lojaId, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {metodosPagamento.map(m => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Observações */}
                          <div>
                            <Label className="text-xs mb-1 block">Observações</Label>
                            <Textarea
                              value={config.obs}
                              onChange={(e) => updateObs(lojaId, e.target.value)}
                              placeholder="Observações para esta loja..."
                              rows={2}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}

          {/* STEP 3: Confirmar e Processar */}
          {step === 3 && (
            <div className="space-y-4">
              {!processando && resultados.length === 0 && (
                <>
                  {/* Resumo */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2 font-medium text-xs">Loja</th>
                          <th className="text-center p-2 font-medium text-xs">Itens</th>
                          <th className="text-center p-2 font-medium text-xs">Pagamento</th>
                          <th className="text-right p-2 font-medium text-xs">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(selectedLojaIds).map(lojaId => {
                          const loja = outrasLojas.find(l => l.id === lojaId);
                          const config = pedidosConfig[lojaId];
                          if (!loja || !config) return null;
                          const metodoLabel = metodosPagamento.find(m => m.value === config.metodo)?.label || config.metodo;
                          return (
                            <tr key={lojaId} className="border-t">
                              <td className="p-2 text-xs">
                                <div className="flex items-center gap-1">
                                  <Store className="w-3 h-3 text-gray-400" />
                                  <span className="font-medium truncate max-w-[150px]">{loja.nome_fantasia || loja.nome}</span>
                                </div>
                              </td>
                              <td className="p-2 text-center text-xs">{config.itens.length}</td>
                              <td className="p-2 text-center text-xs">{metodoLabel}</td>
                              <td className="p-2 text-right text-xs font-bold text-green-600">{formatCurrency(calcularTotalLoja(lojaId))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2">
                        <tr>
                          <td colSpan={3} className="p-2 text-sm font-bold">Total Geral</td>
                          <td className="p-2 text-right text-lg font-bold text-green-600">{formatCurrency(totalGeral)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {/* Processamento em andamento */}
              {processando && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-medium">Criando pedidos...</span>
                  </div>
                  <Progress value={(progressAtual / selectedLojaIds.size) * 100} className="h-3" />
                  <p className="text-center text-sm text-gray-600">
                    {progressAtual} de {selectedLojaIds.size} lojas processadas
                  </p>
                </div>
              )}

              {/* Resultados */}
              {resultados.length > 0 && !processando && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Resultados:</h4>
                  <div className="space-y-2">
                    {resultados.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                          r.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        {r.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                        <span className="font-medium flex-1">{r.lojaNome}</span>
                        {r.success ? (
                          <Badge className="bg-green-600 text-white text-[10px]">Criado</Badge>
                        ) : (
                          <span className="text-xs text-red-600 max-w-[200px] truncate">{r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Footer com botões de navegação */}
        <div className="flex items-center justify-between pt-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={avancarParaStep2}
                disabled={selectedLojaIds.size < 1}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo: Validar Pedidos
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!validarStep2()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Próximo: Confirmar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}

          {step === 3 && !processando && resultados.length === 0 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={processarPedidos}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Confirmar Todos os Pedidos ({selectedLojaIds.size} lojas)
              </Button>
            </>
          )}

          {step === 3 && processando && (
            <div className="w-full text-center text-sm text-gray-500">Aguarde o processamento...</div>
          )}

          {step === 3 && !processando && resultados.length > 0 && (
            <div className="w-full flex justify-end">
              <Button onClick={() => handleOpenChange(false)} className="bg-blue-600 hover:bg-blue-700">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
