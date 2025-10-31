import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export default function MovimentacaoEstoqueForm({ produto, fornecedor, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    tipo_movimentacao: 'entrada',
    quantidade: '',
    motivo: '',
    observacoes: '',
    documento: ''
  });
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantidade || !formData.motivo) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const quantidade = parseInt(formData.quantidade);
    if (isNaN(quantidade) || quantidade === 0) {
      alert('Quantidade inválida.');
      return;
    }

    // Validar saída
    if ((formData.tipo_movimentacao === 'saida' || formData.tipo_movimentacao === 'perda') && 
        Math.abs(quantidade) > produto.estoque_atual_grades) {
      if (!confirm('A quantidade a ser retirada é maior que o estoque atual. Deseja continuar?')) {
        return;
      }
    }

    setSalvando(true);

    try {
      const currentUser = await User.me();
      
      // Calcular nova quantidade
      let quantidadeMovimentacao = quantidade;
      if (formData.tipo_movimentacao === 'saida' || formData.tipo_movimentacao === 'perda') {
        quantidadeMovimentacao = -Math.abs(quantidade);
      } else {
        quantidadeMovimentacao = Math.abs(quantidade);
      }

      const estoqueAnterior = produto.estoque_atual_grades || 0;
      const estoqueNovo = Math.max(0, estoqueAnterior + quantidadeMovimentacao);

      // Criar movimentação
      await MovimentacaoEstoque.create({
        produto_id: produto.id,
        fornecedor_id: produto.fornecedor_id,
        tipo_movimentacao: formData.tipo_movimentacao,
        quantidade: quantidadeMovimentacao,
        quantidade_anterior: estoqueAnterior,
        quantidade_atual: estoqueNovo,
        motivo: formData.motivo,
        usuario_id: currentUser.id,
        observacoes: formData.observacoes,
        documento: formData.documento,
        valor_unitario: produto.custo_por_peca || 0,
        valor_total: (produto.custo_por_peca || 0) * Math.abs(quantidadeMovimentacao) * (produto.total_pecas_grade || 0)
      });

      // Atualizar estoque do produto
      await Produto.update(produto.id, {
        estoque_atual_grades: estoqueNovo
      });

      alert('Movimentação registrada com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      alert('Erro ao registrar movimentação. Tente novamente.');
    } finally {
      setSalvando(false);
    }
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
    const estoqueAtual = produto.estoque_atual_grades || 0;

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
                <p className="text-2xl font-bold text-blue-600">{produto.estoque_atual_grades || 0}</p>
                <p className="text-xs text-gray-600">grades</p>
              </div>
            </div>
          </div>

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
           calcularNovoEstoque() <= produto.estoque_minimo_grades && (
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
    </Dialog>
  );
}