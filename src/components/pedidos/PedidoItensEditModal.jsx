import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Pedido, Carteira } from '@/api/entities';
import { darBaixaEstoque, devolverEstoque } from '@/utils/estoqueUtils';
import { formatCurrency } from '@/utils/exportUtils';
import { Save, X, Trash2, AlertTriangle, Edit } from 'lucide-react';
import { toast } from 'sonner';

// Modal compartilhado (admin + fornecedor) para revisar quantidades dos itens
// de um pedido já criado. Faz a cascata: atualiza pedido.itens,
// recalcula valor_total/final, ajusta estoque pelo delta, redistribui
// títulos pendentes da carteira e registra audit log em observacoes_internas.
export default function PedidoItensEditModal({ pedido, onClose, onUpdate, currentUser }) {
  // Estado local: cada linha aceita uma nova quantidade
  const [itens, setItens] = useState(() =>
    (pedido.itens || []).map((it, idx) => ({
      ...it,
      _idx: idx,
      _quantidadeOriginal: Number(it.quantidade) || 0,
      _novaQuantidade: Number(it.quantidade) || 0,
      _removido: false
    }))
  );
  const [salvando, setSalvando] = useState(false);

  // Pedidos finalizados/cancelados não devem ser editados aqui
  const bloqueado = ['entregue', 'cancelado', 'finalizado'].includes(pedido.status);

  const itensAtivos = itens.filter(i => !i._removido && i._novaQuantidade > 0);

  // Novo valor total = soma de (preço × nova_quantidade) só dos itens ativos
  const novoValorTotal = useMemo(() => {
    return itensAtivos.reduce((sum, i) => {
      const preco = Number(i.preco) || 0;
      return sum + preco * i._novaQuantidade;
    }, 0);
  }, [itensAtivos]);

  const valorAtual = Number(pedido.valor_final ?? pedido.valor_total ?? 0);
  const delta = novoValorTotal - valorAtual;

  // Detecta se houve alguma alteração para habilitar o botão Salvar
  const houveAlteracao = itens.some(i => i._removido || i._novaQuantidade !== i._quantidadeOriginal);

  const handleQuantidadeChange = (idx, valor) => {
    const num = Math.max(0, parseInt(valor, 10) || 0);
    setItens(prev => prev.map(i => i._idx === idx ? { ...i, _novaQuantidade: num, _removido: num === 0 } : i));
  };

  const handleRemover = (idx) => {
    setItens(prev => prev.map(i => i._idx === idx ? { ...i, _removido: true, _novaQuantidade: 0 } : i));
  };

  const handleRestaurar = (idx) => {
    setItens(prev => prev.map(i => i._idx === idx ? { ...i, _removido: false, _novaQuantidade: i._quantidadeOriginal || 1 } : i));
  };

  const handleSalvar = async () => {
    if (bloqueado) return;
    if (itensAtivos.length === 0) {
      toast.error('O pedido precisa ter pelo menos 1 item. Para cancelar tudo, use a opção "Cancelar pedido".');
      return;
    }

    setSalvando(true);
    try {
      // 1) Monta a nova lista de itens (já recalculando total de cada um)
      const novosItens = itensAtivos.map(i => {
        const preco = Number(i.preco) || 0;
        const novaQtd = i._novaQuantidade;
        const novoTotal = preco * novaQtd;
        // remove campos auxiliares internos do estado
        const { _idx, _quantidadeOriginal, _novaQuantidade, _removido, ...resto } = i;
        return { ...resto, quantidade: novaQtd, total: novoTotal };
      });

      // 2) Monta listas auxiliares pra ajustar estoque pelo delta
      const itensParaDevolver = [];
      const itensParaBaixar = [];
      itens.forEach(i => {
        const qtdOriginal = i._quantidadeOriginal;
        const qtdNova = i._removido ? 0 : i._novaQuantidade;
        const deltaQtd = qtdNova - qtdOriginal;
        if (deltaQtd === 0) return;
        const { _idx, _quantidadeOriginal, _novaQuantidade, _removido, ...itemBase } = i;
        if (deltaQtd < 0) {
          // Reduzir quantidade → devolver |delta| ao estoque
          itensParaDevolver.push({ ...itemBase, quantidade: Math.abs(deltaQtd) });
        } else {
          // Aumentar quantidade → dar baixa adicional
          itensParaBaixar.push({ ...itemBase, quantidade: deltaQtd });
        }
      });

      // 3) Aplica ajuste de estoque (só se o pedido já teve baixa anterior)
      if (pedido.estoque_baixado) {
        if (itensParaDevolver.length > 0) {
          try {
            await devolverEstoque(itensParaDevolver);
          } catch (e) {
            console.error('Erro ao devolver estoque:', e);
          }
        }
        if (itensParaBaixar.length > 0) {
          try {
            await darBaixaEstoque(itensParaBaixar);
          } catch (e) {
            console.error('Erro ao dar baixa adicional no estoque:', e);
          }
        }
      }

      // 4) Audit log
      const agora = new Date();
      const dataStr = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const quemFez = currentUser?.full_name || currentUser?.email || 'Sistema';
      const linhasLog = [];
      itens.forEach(i => {
        const qtdOriginal = i._quantidadeOriginal;
        const qtdNova = i._removido ? 0 : i._novaQuantidade;
        if (qtdOriginal === qtdNova) return;
        if (qtdNova === 0) {
          linhasLog.push(`- REMOVIDO: ${i.nome}${i.cor_selecionada?.cor_nome ? ` (${i.cor_selecionada.cor_nome})` : ''}`);
        } else {
          linhasLog.push(`- ${i.nome}${i.cor_selecionada?.cor_nome ? ` (${i.cor_selecionada.cor_nome})` : ''}: ${qtdOriginal} → ${qtdNova}`);
        }
      });
      const logBlock = `[${dataStr} - ${quemFez}] Itens revisados:
${linhasLog.join('\n')}
Valor: ${formatCurrency(valorAtual)} → ${formatCurrency(novoValorTotal)}`;

      const novasObservacoesInternas = (pedido.observacoes_internas || '')
        + (pedido.observacoes_internas ? '\n\n' : '')
        + logBlock;

      // 5) Atualiza o pedido (sinaliza itens_revisados_em → webhook dispara e-mail)
      await Pedido.update(pedido.id, {
        itens: novosItens,
        valor_total: novoValorTotal,
        valor_final: novoValorTotal,
        observacoes_internas: novasObservacoesInternas,
        itens_revisados_em: agora.toISOString()
      });

      // 6) Carteira: redistribui valor pelos títulos pendentes
      try {
        const titulos = await Carteira.filter({ pedido_id: pedido.id });
        if (titulos && titulos.length > 0) {
          const pendentes = titulos.filter(t => t.status === 'pendente');
          const pagos = titulos.filter(t => t.status === 'pago');
          const valorPago = pagos.reduce((s, t) => s + (Number(t.valor) || 0), 0);
          const valorRestante = Math.max(0, novoValorTotal - valorPago);

          if (pendentes.length > 0) {
            const valorPorPendente = Math.round((valorRestante / pendentes.length) * 100) / 100;
            for (const titulo of pendentes) {
              await Carteira.update(titulo.id, { valor: valorPorPendente });
            }
          }
        }
      } catch (carteiraErr) {
        console.error('Erro ao atualizar carteira:', carteiraErr);
      }

      toast.success('Itens revisados com sucesso! Cliente será notificado por e-mail.');
      if (onUpdate) onUpdate();
      if (onClose) onClose();
    } catch (err) {
      console.error('Erro ao salvar revisão:', err);
      toast.error('Erro ao salvar: ' + (err?.message || ''));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            Revisar itens do pedido #{String(pedido.id).slice(-8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        {bloqueado && (
          <Alert className="bg-gray-50 border-gray-300">
            <AlertDescription>
              Este pedido está em status <strong>{pedido.status}</strong> e não pode mais ser revisado.
            </AlertDescription>
          </Alert>
        )}

        {!bloqueado && (
          <Alert className="bg-yellow-50 border-yellow-300">
            <AlertTriangle className="w-4 h-4 text-yellow-700" />
            <AlertDescription className="text-yellow-900">
              <strong>Atenção:</strong> alterar quantidades vai recalcular o valor total, ajustar o estoque
              e redistribuir os títulos pendentes da carteira. O cliente recebe um e-mail informando.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 py-2">
          {itens.map((item) => {
            const preco = Number(item.preco) || 0;
            const subtotal = preco * item._novaQuantidade;
            const removido = item._removido;
            return (
              <div
                key={item._idx}
                className={`p-3 rounded-lg border ${removido ? 'bg-red-50 border-red-200 opacity-60' : 'bg-white border-gray-200'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${removido ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {item.nome}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-1">
                      {item.cor_selecionada?.cor_nome && (
                        <span>Cor: <strong>{item.cor_selecionada.cor_nome}</strong></span>
                      )}
                      {item.tipo_venda && <span>Tipo: <strong>{item.tipo_venda}</strong></span>}
                      <span>Preço: <strong>{formatCurrency(preco)}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {removido ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bloqueado}
                        onClick={() => handleRestaurar(item._idx)}
                      >
                        Restaurar
                      </Button>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Qtd:</label>
                          <Input
                            type="number"
                            min="0"
                            value={item._novaQuantidade}
                            disabled={bloqueado}
                            onChange={(e) => handleQuantidadeChange(item._idx, e.target.value)}
                            className="w-20 h-9 text-center"
                          />
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-xs text-gray-500">Subtotal</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(subtotal)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={bloqueado}
                          onClick={() => handleRemover(item._idx)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {item._quantidadeOriginal !== item._novaQuantidade && (
                  <p className="text-xs text-blue-700 mt-2">
                    Quantidade original: {item._quantidadeOriginal} → {removido ? '0 (removido)' : item._novaQuantidade}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumo do total */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1">
          <div className="flex justify-between text-sm text-gray-700">
            <span>Valor atual:</span>
            <span className="font-semibold">{formatCurrency(valorAtual)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Valor novo:</span>
            <span className="font-bold text-blue-900 text-lg">{formatCurrency(novoValorTotal)}</span>
          </div>
          {delta !== 0 && (
            <div className={`flex justify-between text-sm font-semibold ${delta < 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>Diferença:</span>
              <span>{delta > 0 ? '+' : ''}{formatCurrency(delta)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando || bloqueado || !houveAlteracao || itensAtivos.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {salvando ? 'Salvando...' : 'Salvar revisão'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
