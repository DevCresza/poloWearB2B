import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MovimentacaoEstoque } from '@/api/entities';
import { Produto } from '@/api/entities';
import { User } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Package, Save, X, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export default function MovimentacaoEstoqueForm({ produto, fornecedor, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    tipo_movimentacao: 'entrada',
    quantidade: '',
    motivo: '',
    observacoes: '',
    documento: ''
  });
  const [salvando, setSalvando] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [selectedVariante, setSelectedVariante] = useState('produto');

  let variantes = [];
  if (produto.tem_variantes_cor) {
    try {
      variantes = typeof produto.variantes_cor === 'string' ? JSON.parse(produto.variantes_cor) : (produto.variantes_cor || []);
      if (!Array.isArray(variantes)) variantes = [];
    } catch (e) {
      variantes = [];
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantidade || !formData.motivo) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const quantidade = parseInt(formData.quantidade);
    if (isNaN(quantidade) || quantidade === 0) {
      toast.info('Quantidade inválida.');
      return;
    }

    // Validar saída
    const estoqueCheck = selectedVariante !== 'produto'
      ? (variantes.find(v => v.id === selectedVariante)?.estoque_grades || 0)
      : produto.estoque_atual_grades;
    if ((formData.tipo_movimentacao === 'saida' || formData.tipo_movimentacao === 'perda') &&
        Math.abs(quantidade) > estoqueCheck) {
      setPendingSubmit({ quantidade, formData });
      setShowConfirmDialog(true);
      return;
    }

    // Se não precisa de confirmação, executar diretamente
    await executeSubmit(quantidade);
  };

  const executeSubmit = async (quantidade) => {
    setSalvando(true);

    try {
      const currentUser = await User.me();

      let quantidadeMovimentacao = quantidade;
      if (formData.tipo_movimentacao === 'saida' || formData.tipo_movimentacao === 'perda') {
        quantidadeMovimentacao = -Math.abs(quantidade);
      } else {
        quantidadeMovimentacao = Math.abs(quantidade);
      }

      if (selectedVariante !== 'produto' && variantes.length > 0) {
        // Per-variant stock update
        const varianteAtual = variantes.find(v => v.id === selectedVariante);
        const estoqueAnteriorVar = varianteAtual?.estoque_grades || 0;
        const estoqueNovoVar = Math.max(0, estoqueAnteriorVar + quantidadeMovimentacao);

        // Update the variant in the array
        const novasVariantes = variantes.map(v =>
          v.id === selectedVariante ? { ...v, estoque_grades: estoqueNovoVar } : v
        );

        // Recalculate product-level stock as sum of all variants
        const novoProdutoEstoque = novasVariantes.reduce((sum, v) => sum + (v.estoque_grades || 0), 0);

        // Create movement record
        await MovimentacaoEstoque.create({
          produto_id: produto.id,
          tipo: formData.tipo_movimentacao,
          quantidade_grades: quantidadeMovimentacao,
          quantidade_anterior: estoqueAnteriorVar,
          quantidade_atual: estoqueNovoVar,
          motivo: formData.motivo,
          user_id: currentUser.id,
          observacoes: `[${varianteAtual?.cor_nome}] ${formData.observacoes || ''}`
        });

        // Update product with new variant data and recalculated total
        await Produto.update(produto.id, {
          variantes_cor: novasVariantes,
          estoque_atual_grades: novoProdutoEstoque
        });
      } else {
        // Product-level stock update (existing behavior)
        const estoqueAnterior = produto.estoque_atual_grades || 0;
        const estoqueNovo = Math.max(0, estoqueAnterior + quantidadeMovimentacao);

        await MovimentacaoEstoque.create({
          produto_id: produto.id,
          tipo: formData.tipo_movimentacao,
          quantidade_grades: quantidadeMovimentacao,
          quantidade_anterior: estoqueAnterior,
          quantidade_atual: estoqueNovo,
          motivo: formData.motivo,
          user_id: currentUser.id,
          observacoes: formData.observacoes
        });

        await Produto.update(produto.id, {
          estoque_atual_grades: estoqueNovo
        });
      }

      toast.success('Movimentação registrada com sucesso!');
      onSuccess();
    } catch (_error) {
      toast.error('Erro ao registrar movimentação. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmDialog(false);
    if (pendingSubmit) {
      await executeSubmit(pendingSubmit.quantidade);
      setPendingSubmit(null);
    }
  };

  const handleCancelSubmit = () => {
    setShowConfirmDialog(false);
    setPendingSubmit(null);
  };

  const getTipoInfo = (tipo) => {
    const tipos = {
      entrada: { label: 'Entrada', icon: TrendingUp, color: 'text-green-600', description: 'Adicionar ao estoque' },
      saida: { label: 'Saída', icon: TrendingDown, color: 'text-red-600', description: 'Remover do estoque' },
      ajuste: { label: 'Ajuste', icon: Package, color: 'text-blue-600', description: 'Ajuste manual' },
      perda: { label: 'Perda', icon: AlertTriangle, color: 'text-orange-600', description: 'Perda de estoque' },
      devolucao: { label: 'Devolução', icon: TrendingUp, color: 'text-purple-600', description: 'Devolução de cliente' }
    };
    return tipos[tipo] || tipos.entrada;
  };

  const tipoInfo = getTipoInfo(formData.tipo_movimentacao);
  const TipoIcon = tipoInfo.icon;

  const calcularNovoEstoque = () => {
    const quantidade = parseInt(formData.quantidade) || 0;
    let estoqueAtual;
    if (selectedVariante !== 'produto') {
      const v = variantes.find(v => v.id === selectedVariante);
      estoqueAtual = v?.estoque_grades || 0;
    } else {
      estoqueAtual = produto.estoque_atual_grades || 0;
    }

    if (formData.tipo_movimentacao === 'saida' || formData.tipo_movimentacao === 'perda') {
      return Math.max(0, estoqueAtual - Math.abs(quantidade));
    } else {
      return estoqueAtual + Math.abs(quantidade);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Movimentar Estoque
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Informações do Produto */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{produto.nome}</h3>
                <p className="text-sm text-gray-600">{fornecedor?.nome_marca}</p>
                <p className="text-xs text-gray-500">
                  Ref: {produto.referencia_polo || produto.referencia_fornecedor || 'N/A'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Estoque Atual</p>
                <p className="text-2xl font-bold text-blue-600">
                  {selectedVariante !== 'produto'
                    ? (variantes.find(v => v.id === selectedVariante)?.estoque_grades || 0)
                    : (produto.estoque_atual_grades || 0)
                  }
                </p>
                <p className="text-xs text-gray-600">grades</p>
                {selectedVariante !== 'produto' && (
                  <p className="text-xs text-blue-600 mt-1">
                    {variantes.find(v => v.id === selectedVariante)?.cor_nome}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Seletor de Variante */}
          {variantes.length > 0 && (
            <div className="space-y-2">
              <Label>Aplicar movimentação em</Label>
              <Select value={selectedVariante} onValueChange={setSelectedVariante}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">
                    <span>Produto inteiro (todas as cores)</span>
                  </SelectItem>
                  {variantes.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: v.cor_codigo_hex || v.cor_hex || '#000' }} />
                        <span>{v.cor_nome} ({v.estoque_grades || 0} grades)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tipo de Movimentação */}
          <div className="space-y-2">
            <Label htmlFor="tipo_movimentacao">Tipo de Movimentação *</Label>
            <Select 
              value={formData.tipo_movimentacao} 
              onValueChange={(value) => setFormData({ ...formData, tipo_movimentacao: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span>Entrada - Adicionar ao estoque</span>
                  </div>
                </SelectItem>
                <SelectItem value="saida">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span>Saída - Remover do estoque</span>
                  </div>
                </SelectItem>
                <SelectItem value="ajuste">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Ajuste - Correção manual</span>
                  </div>
                </SelectItem>
                <SelectItem value="perda">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span>Perda - Avaria/Extravio</span>
                  </div>
                </SelectItem>
                <SelectItem value="devolucao">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <span>Devolução - Retorno de cliente</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600">{tipoInfo.description}</p>
          </div>

          {/* Quantidade */}
          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade (em grades) *</Label>
            <Input
              id="quantidade"
              type="number"
              min="1"
              value={formData.quantidade}
              onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
              placeholder="Ex: 10"
              required
            />
            {formData.quantidade && (
              <div className="flex items-center gap-2 text-sm">
                <TipoIcon className={`w-4 h-4 ${tipoInfo.color}`} />
                <span>
                  Novo estoque: <strong>{calcularNovoEstoque()}</strong> grades
                </span>
              </div>
            )}
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Input
              id="motivo"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ex: Recebimento de fornecedor, Venda para cliente, etc."
              required
            />
          </div>

          {/* Documento */}
          <div className="space-y-2">
            <Label htmlFor="documento">Número do Documento (opcional)</Label>
            <Input
              id="documento"
              value={formData.documento}
              onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
              placeholder="Ex: NF 12345, Pedido #67890"
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre a movimentação..."
              rows={3}
            />
          </div>

          {/* Alerta de Estoque Baixo */}
          {(formData.tipo_movimentacao === 'saida' || formData.tipo_movimentacao === 'perda') &&
           formData.quantidade &&
           calcularNovoEstoque() <= (selectedVariante !== 'produto' ? (variantes.find(v => v.id === selectedVariante)?.estoque_minimo || 0) : produto.estoque_minimo_grades) && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Atenção:</strong> Esta movimentação deixará o estoque abaixo do mínimo ({produto.estoque_minimo_grades} grades).
              </AlertDescription>
            </Alert>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : 'Registrar Movimentação'}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Dialog de confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Confirmar Retirada
            </DialogTitle>
            <DialogDescription>
              A quantidade a ser retirada é maior que o estoque atual.
              Isso resultará em estoque negativo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Atenção:</strong> Esta ação não é recomendada e pode causar problemas
                no controle de estoque.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSubmit}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSubmit} variant="destructive">
              Continuar Mesmo Assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}