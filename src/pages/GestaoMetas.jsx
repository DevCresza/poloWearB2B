import { useState, useEffect } from 'react';
import { Meta } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Target, TrendingUp, TrendingDown, Plus, Edit, Calendar,
  DollarSign, Package, AlertTriangle, CheckCircle
} from 'lucide-react';

export default function GestaoMetas() {
  const [metas, setMetas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMeta, setEditingMeta] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);

  const [formData, setFormData] = useState({
    ano: new Date().getFullYear(),
    meses_selecionados: [new Date().getMonth() + 1],
    tipo_entidade: 'geral', // geral, fornecedor, cliente
    fornecedor_id: '',
    user_id: '',
    valor_meta: 0,
    pecas_meta: 0
  });

  useEffect(() => {
    loadData();
  }, [anoSelecionado, mesSelecionado]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metasList, fornecedoresList, clientesList] = await Promise.all([
        Meta.filter({ ano: anoSelecionado, mes: mesSelecionado }),
        Fornecedor.list(),
        User.filter({ tipo_negocio: 'multimarca' })
      ]);

      // Atualizar realizado de cada meta
      for (const meta of metasList) {
        await atualizarRealizadoMeta(meta);
      }

      setMetas(metasList);
      setFornecedores(fornecedoresList);
      setClientes(clientesList);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const atualizarRealizadoMeta = async (meta) => {
    try {
      const dataInicio = new Date(meta.ano, meta.mes - 1, 1);
      const dataFim = new Date(meta.ano, meta.mes, 0);

      let pedidos = await Pedido.filter({ status: 'finalizado' });

      // Filtrar pedidos do período
      pedidos = pedidos.filter(p => {
        const dataPedido = new Date(p.created_date);
        return dataPedido >= dataInicio && dataPedido <= dataFim;
      });

      // Filtrar por tipo de meta (baseado nos IDs, não no campo tipo)
      if (meta.fornecedor_id) {
        pedidos = pedidos.filter(p => p.fornecedor_id === meta.fornecedor_id);
      } else if (meta.user_id) {
        pedidos = pedidos.filter(p => p.comprador_user_id === meta.user_id);
      }

      const valorRealizado = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
      
      // Calcular peças realizadas
      let pecasRealizadas = 0;
      pedidos.forEach(p => {
        try {
          const itens = Array.isArray(p.itens) ? p.itens : JSON.parse(p.itens);
          itens.forEach(item => {
            if (item.tipo_venda === 'grade') {
              pecasRealizadas += (item.quantidade || 0) * (item.total_pecas_grade || 0);
            } else {
              pecasRealizadas += item.quantidade || 0;
            }
          });
        } catch (e) {
        }
      });

      const percentualValor = meta.valor_meta > 0
        ? (valorRealizado / meta.valor_meta) * 100
        : 0;
      const percentualPecas = meta.pecas_meta > 0
        ? (pecasRealizadas / meta.pecas_meta) * 100
        : 0;

      // Usar o menor percentual como percentual geral
      const percentualAtingido = Math.min(percentualValor, percentualPecas);

      let status = 'abaixo';
      if (percentualAtingido >= 100) status = 'superada';
      else if (percentualAtingido >= 90) status = 'atingida';
      else if (percentualAtingido >= 70) status = 'atencao';

      await Meta.update(meta.id, {
        valor_atual: valorRealizado,
        pecas_realizadas: pecasRealizadas,
        percentual_atingido: percentualAtingido,
        status: status
      });

      // Atualizar no estado local (usando nomes amigáveis para a UI)
      meta.valor_atual = valorRealizado;
      meta.pecas_realizadas = pecasRealizadas;
      meta.percentual_atingido = percentualAtingido;
      meta.percentual_valor = percentualValor; // Para exibição na UI
      meta.percentual_pecas = percentualPecas; // Para exibição na UI
      meta.status = status;
    } catch (error) {
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Função para calcular periodo_inicio e periodo_fim a partir de ano e mês
      const calcularPeriodo = (ano, mes) => {
        const inicio = new Date(ano, mes - 1, 1);
        const fim = new Date(ano, mes, 0); // Último dia do mês
        return {
          periodo_inicio: inicio.toISOString().split('T')[0],
          periodo_fim: fim.toISOString().split('T')[0]
        };
      };

      if (editingMeta) {
        // Ao editar, atualiza apenas o mês original da meta
        const { periodo_inicio, periodo_fim } = calcularPeriodo(formData.ano, formData.meses_selecionados[0]);
        await Meta.update(editingMeta.id, {
          ano: formData.ano,
          mes: formData.meses_selecionados[0],
          tipo: 'mensal', // Tipo válido para o banco
          periodo_inicio,
          periodo_fim,
          fornecedor_id: formData.tipo_entidade === 'fornecedor' ? formData.fornecedor_id : null,
          user_id: formData.tipo_entidade === 'cliente' ? formData.user_id : null,
          valor_meta: formData.valor_meta,
          pecas_meta: formData.pecas_meta
        });
        toast.success('Meta atualizada com sucesso!');
      } else {
        // Ao criar, cria uma meta para cada mês selecionado
        if (formData.meses_selecionados.length === 0) {
          toast.error('Selecione pelo menos um mês');
          return;
        }

        for (const mes of formData.meses_selecionados) {
          const { periodo_inicio, periodo_fim } = calcularPeriodo(formData.ano, mes);
          await Meta.create({
            ano: formData.ano,
            mes: mes,
            tipo: 'mensal', // Tipo válido para o banco
            periodo_inicio,
            periodo_fim,
            fornecedor_id: formData.tipo_entidade === 'fornecedor' ? formData.fornecedor_id : null,
            user_id: formData.tipo_entidade === 'cliente' ? formData.user_id : null,
            valor_meta: formData.valor_meta,
            pecas_meta: formData.pecas_meta
          });
        }
        toast.success(`${formData.meses_selecionados.length} meta(s) criada(s) com sucesso!`);
      }

      setShowForm(false);
      setEditingMeta(null);
      setFormData({
        ano: new Date().getFullYear(),
        meses_selecionados: [new Date().getMonth() + 1],
        tipo_entidade: 'geral',
        fornecedor_id: '',
        user_id: '',
        valor_meta: 0,
        pecas_meta: 0
      });
      loadData();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast.error('Erro ao salvar meta');
    }
  };

  const handleEdit = (meta) => {
    setEditingMeta(meta);
    // Determinar tipo_entidade baseado nos IDs
    let tipo_entidade = 'geral';
    if (meta.fornecedor_id) tipo_entidade = 'fornecedor';
    else if (meta.user_id) tipo_entidade = 'cliente';

    setFormData({
      ano: meta.ano,
      meses_selecionados: [meta.mes],
      tipo_entidade,
      fornecedor_id: meta.fornecedor_id || '',
      user_id: meta.user_id || '',
      valor_meta: meta.valor_meta,
      pecas_meta: meta.pecas_meta
    });
    setShowForm(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      abaixo: 'bg-red-100 text-red-800',
      atencao: 'bg-yellow-100 text-yellow-800',
      atingida: 'bg-green-100 text-green-800',
      superada: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || colors.abaixo;
  };

  const getStatusIcon = (status) => {
    if (status === 'atingida' || status === 'superada') return <CheckCircle className="w-4 h-4" />;
    if (status === 'atencao') return <AlertTriangle className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getNomeEntidade = (meta) => {
    // Determinar tipo baseado nos IDs (não no campo tipo do banco)
    if (meta.fornecedor_id) {
      const fornecedor = fornecedores.find(f => f.id === meta.fornecedor_id);
      return fornecedor?.nome_marca || fornecedor?.nome_fantasia || 'Fornecedor';
    }
    if (meta.user_id) {
      const cliente = clientes.find(c => c.id === meta.user_id);
      return cliente?.nome_empresa || cliente?.full_name || 'Cliente';
    }
    return 'Meta Geral';
  };

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Metas</h1>
          <p className="text-gray-600">Defina e acompanhe metas de vendas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Filtros de Período */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>Ano</Label>
              <Select value={anoSelecionado.toString()} onValueChange={(value) => setAnoSelecionado(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(ano => (
                    <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mês</Label>
              <Select value={mesSelecionado.toString()} onValueChange={(value) => setMesSelecionado(parseInt(value))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={loadData}>
              Atualizar Dados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metas.map(meta => (
          <Card key={meta.id} className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">{getNomeEntidade(meta)}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(meta.status)}>
                    {getStatusIcon(meta.status)}
                    {meta.status}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(meta)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Meta de Valor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Faturamento</span>
                  </div>
                  <span className="text-sm font-bold">
                    {(meta.percentual_valor || 0).toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(meta.percentual_valor || 0, 100)} className="h-2" />
                <div className="flex justify-between mt-1 text-xs text-gray-600">
                  <span>R$ {(meta.valor_atual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span>R$ {(meta.valor_meta || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Meta de Peças */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium">Peças</span>
                  </div>
                  <span className="text-sm font-bold">
                    {(meta.percentual_pecas || 0).toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(meta.percentual_pecas || 0, 100)} className="h-2" />
                <div className="flex justify-between mt-1 text-xs text-gray-600">
                  <span>{meta.pecas_realizadas || 0} pç</span>
                  <span>{meta.pecas_meta || 0} pç</span>
                </div>
              </div>

              {/* Resumo */}
              <div className="pt-3 border-t">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Falta Faturar:</span>
                    <p className="font-semibold text-orange-600">
                      R$ {Math.max(0, (meta.valor_meta || 0) - (meta.valor_atual || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Falta Vender:</span>
                    <p className="font-semibold text-orange-600">
                      {Math.max(0, (meta.pecas_meta || 0) - (meta.pecas_realizadas || 0))} peças
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {metas.length === 0 && (
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-12 text-center">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhuma meta cadastrada para este período
            </h3>
            <p className="text-gray-600 mb-4">
              Crie metas para acompanhar o desempenho de vendas
            </p>
            <Button onClick={() => setShowForm(true)} className="bg-blue-600">
              <Plus className="w-5 h-5 mr-2" />
              Criar Primeira Meta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal de Formulário */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMeta ? 'Editar Meta' : 'Nova Meta'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div>
              <Label>Ano *</Label>
              <Select
                value={formData.ano.toString()}
                onValueChange={(value) => setFormData({...formData, ano: parseInt(value)})}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(ano => (
                    <SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-3 block">
                {editingMeta ? 'Mês *' : 'Meses * (selecione um ou mais)'}
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {meses.map((mes, index) => {
                  const mesNum = index + 1;
                  const isChecked = formData.meses_selecionados.includes(mesNum);
                  return (
                    <div
                      key={mesNum}
                      className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (editingMeta) {
                          // Ao editar, permite apenas um mês
                          setFormData({...formData, meses_selecionados: [mesNum]});
                        } else {
                          // Ao criar, permite múltiplos
                          const newMeses = isChecked
                            ? formData.meses_selecionados.filter(m => m !== mesNum)
                            : [...formData.meses_selecionados, mesNum];
                          setFormData({...formData, meses_selecionados: newMeses});
                        }
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => {}}
                        className="pointer-events-none"
                      />
                      <span className="text-sm">{mes.substring(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
              {!editingMeta && formData.meses_selecionados.length > 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  {formData.meses_selecionados.length} mês(es) selecionado(s)
                </p>
              )}
            </div>

            <div>
              <Label>Tipo de Meta *</Label>
              <Select
                value={formData.tipo_entidade}
                onValueChange={(value) => setFormData({...formData, tipo_entidade: value, fornecedor_id: '', user_id: ''})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Meta Geral</SelectItem>
                  <SelectItem value="fornecedor">Por Fornecedor</SelectItem>
                  <SelectItem value="cliente">Por Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.tipo_entidade === 'fornecedor' && (
              <div>
                <Label>Fornecedor *</Label>
                <Select 
                  value={formData.fornecedor_id} 
                  onValueChange={(value) => setFormData({...formData, fornecedor_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia || f.nome_marca}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.tipo_entidade === 'cliente' && (
              <div>
                <Label>Cliente *</Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(value) => setFormData({...formData, user_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_empresa || c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Meta de Faturamento (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_meta}
                  onChange={(e) => setFormData({...formData, valor_meta: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>

              <div>
                <Label>Meta de Peças *</Label>
                <Input
                  type="number"
                  value={formData.pecas_meta}
                  onChange={(e) => setFormData({...formData, pecas_meta: parseInt(e.target.value) || 0})}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => {
                setShowForm(false);
                setEditingMeta(null);
              }}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {editingMeta ? 'Atualizar' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}