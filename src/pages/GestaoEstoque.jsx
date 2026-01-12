import { useState, useEffect } from 'react';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { MovimentacaoEstoque } from '@/api/entities';
import { User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Package, AlertTriangle, TrendingUp, TrendingDown, 
  Search, Filter, Download, Plus, History, BarChart3
} from 'lucide-react';
import MovimentacaoEstoqueForm from '../components/estoque/MovimentacaoEstoqueForm';
import { formatCurrency } from '@/utils/exportUtils';

export default function GestaoEstoque() {
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('todos');
  const [filtroAlerta, setFiltroAlerta] = useState('todos');
  const [showMovimentacaoForm, setShowMovimentacaoForm] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [activeTab, setActiveTab] = useState('produtos');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let produtosList, fornecedoresList, movimentacoesList;

      if (currentUser.tipo_negocio === 'fornecedor') {
        // Usar fornecedor_id do usuário diretamente (se disponível)
        // ou buscar fornecedor pelo responsavel_user_id (fallback para usuários antigos)
        let fornecedorId = currentUser.fornecedor_id;
        let fornecedor = null;

        if (fornecedorId) {
          // Buscar dados do fornecedor pelo ID
          fornecedor = await Fornecedor.get(fornecedorId);
        } else {
          // Fallback: buscar fornecedor pelo responsavel_user_id
          const fornecedoresListTemp = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
          fornecedor = fornecedoresListTemp[0];
          if (fornecedor) {
            fornecedorId = fornecedor.id;
          }
        }

        if (fornecedor) {
          // Fornecedor vê apenas seus produtos
          produtosList = await Produto.filter({
            fornecedor_id: fornecedorId
          });
          fornecedoresList = [fornecedor]; // Apenas seu próprio fornecedor

          // Buscar movimentações dos produtos deste fornecedor
          // (movimentacoes_estoque não tem fornecedor_id, então filtramos por produto_id)
          const produtoIds = produtosList.map(p => p.id);
          if (produtoIds.length > 0) {
            // Buscar todas movimentações e filtrar localmente por produto_id
            const todasMovimentacoes = await MovimentacaoEstoque.list('-created_at', 100);
            movimentacoesList = todasMovimentacoes.filter(m => produtoIds.includes(m.produto_id));
          } else {
            movimentacoesList = [];
          }
        } else {
          produtosList = [];
          fornecedoresList = [];
          movimentacoesList = [];
        }
      } else if (currentUser.role === 'admin') {
        // Admin vê todos os produtos (removido filtro controla_estoque)
        produtosList = await Produto.list('-created_at');
        fornecedoresList = await Fornecedor.list();
        movimentacoesList = await MovimentacaoEstoque.list('-created_at', 100);
      }

      setProdutos(produtosList || []);
      setFornecedores(fornecedoresList || []);
      setMovimentacoes(movimentacoesList || []);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const handleMovimentacao = (produto) => {
    setSelectedProduto(produto);
    setShowMovimentacaoForm(true);
  };

  const getFornecedorNome = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    return fornecedor ? (fornecedor.nome_fantasia || fornecedor.razao_social) : 'N/A';
  };

  const getStatusEstoque = (produto) => {
    if (!produto.controla_estoque) {
      return { label: 'Sem Controle', color: 'bg-gray-100 text-gray-800', icon: Package };
    }

    const estoque = produto.estoque_atual_grades || 0;
    const minimo = produto.estoque_minimo_grades || 0;

    if (estoque === 0) {
      return { label: 'Sem Estoque', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    } else if (estoque <= minimo) {
      return { label: 'Estoque Baixo', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle };
    } else {
      return { label: 'Normal', color: 'bg-green-100 text-green-800', icon: Package };
    }
  };

  const filteredProdutos = produtos.filter(produto => {
    const matchesSearch = produto.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         produto.referencia_polo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         produto.referencia_fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFornecedor = filtroFornecedor === 'todos' || produto.fornecedor_id === filtroFornecedor;

    let matchesAlerta = true;
    if (filtroAlerta === 'zerado') {
      matchesAlerta = produto.estoque_atual_grades === 0;
    } else if (filtroAlerta === 'baixo') {
      matchesAlerta = produto.estoque_atual_grades > 0 &&
                     produto.estoque_atual_grades <= produto.estoque_minimo_grades;
    } else if (filtroAlerta === 'normal') {
      matchesAlerta = produto.estoque_atual_grades > produto.estoque_minimo_grades;
    }

    return matchesSearch && matchesFornecedor && matchesAlerta;
  });

  // Estatísticas
  const totalProdutos = produtos.length;
  const produtosZerados = produtos.filter(p => p.estoque_atual_grades === 0).length;
  const produtosBaixos = produtos.filter(p => 
    p.estoque_atual_grades > 0 && 
    p.estoque_atual_grades <= p.estoque_minimo_grades
  ).length;
  const estoqueTotal = produtos.reduce((sum, p) => sum + (p.estoque_atual_grades || 0), 0);
  const valorEstoque = produtos.reduce((sum, p) => 
    sum + ((p.estoque_atual_grades || 0) * (p.custo_por_peca || 0) * (p.total_pecas_grade || 0)), 0
  );

  const getTipoMovimentacaoInfo = (tipo) => {
    const tipos = {
      entrada: { label: 'Entrada', color: 'bg-green-100 text-green-800', icon: TrendingUp },
      saida: { label: 'Saída', color: 'bg-red-100 text-red-800', icon: TrendingDown },
      ajuste: { label: 'Ajuste', color: 'bg-blue-100 text-blue-800', icon: Package },
      perda: { label: 'Perda', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
      devolucao: { label: 'Devolução', color: 'bg-purple-100 text-purple-800', icon: TrendingUp }
    };
    return tipos[tipo] || tipos.entrada;
  };

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
        .shadow-neumorphic-inset { box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestão de Estoque</h1>
          <p className="text-gray-600">Controle completo do estoque de produtos</p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-blue-600 opacity-80" />
            </div>
            <p className="text-sm text-gray-600">Total de Produtos</p>
            <p className="text-3xl font-bold text-gray-900">{totalProdutos}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-8 h-8 text-green-600 opacity-80" />
            </div>
            <p className="text-sm text-gray-600">Estoque Total (Grades)</p>
            <p className="text-3xl font-bold text-gray-900">{estoqueTotal}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-red-600 opacity-80" />
            </div>
            <p className="text-sm text-gray-600">Produtos Zerados</p>
            <p className="text-3xl font-bold text-red-600">{produtosZerados}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-orange-600 opacity-80" />
            </div>
            <p className="text-sm text-gray-600">Estoque Baixo</p>
            <p className="text-3xl font-bold text-orange-600">{produtosBaixos}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-purple-600 opacity-80" />
            </div>
            <p className="text-sm text-gray-600">Valor em Estoque</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(valorEstoque)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full md:w-96">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="movimentacoes">Histórico</TabsTrigger>
        </TabsList>

        {/* Aba de Produtos */}
        <TabsContent value="produtos" className="space-y-4">
          {/* Alertas */}
          {produtosZerados > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Atenção!</strong> {produtosZerados} produto(s) sem estoque.
              </AlertDescription>
            </Alert>
          )}

          {produtosBaixos > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Aviso:</strong> {produtosBaixos} produto(s) com estoque baixo.
              </AlertDescription>
            </Alert>
          )}

          {/* Filtros */}
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome ou referência..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-xl shadow-neumorphic-inset"
                  />
                </div>

                <select
                  value={filtroFornecedor}
                  onChange={(e) => setFiltroFornecedor(e.target.value)}
                  className="px-4 py-2 rounded-xl border bg-white shadow-neumorphic-inset"
                >
                  <option value="todos">Todos os Fornecedores</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia || f.nome_marca}</option>
                  ))}
                </select>

                <select
                  value={filtroAlerta}
                  onChange={(e) => setFiltroAlerta(e.target.value)}
                  className="px-4 py-2 rounded-xl border bg-white shadow-neumorphic-inset"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="zerado">Sem Estoque</option>
                  <option value="baixo">Estoque Baixo</option>
                  <option value="normal">Estoque Normal</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Produtos */}
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-center">Estoque Atual</TableHead>
                      <TableHead className="text-center">Estoque Mínimo</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Nenhum produto encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProdutos.map(produto => {
                        const status = getStatusEstoque(produto);
                        const StatusIcon = status.icon;

                        return (
                          <TableRow key={produto.id}>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{produto.nome}</p>
                                <p className="text-xs text-gray-600">
                                  Ref: {produto.referencia_polo || produto.referencia_fornecedor || 'N/A'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{getFornecedorNome(produto.fornecedor_id)}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-lg font-bold">{produto.estoque_atual_grades || 0}</span>
                              <span className="text-xs text-gray-600"> grades</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm">{produto.estoque_minimo_grades || 0}</span>
                              <span className="text-xs text-gray-600"> grades</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`${status.color} gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMovimentacao(produto)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Movimentar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Movimentações */}
        <TabsContent value="movimentacoes" className="space-y-4">
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Nenhuma movimentação registrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      movimentacoes.map(mov => {
                        const produto = produtos.find(p => p.id === mov.produto_id);
                        const tipoInfo = getTipoMovimentacaoInfo(mov.tipo_movimentacao);
                        const TipoIcon = tipoInfo.icon;

                        return (
                          <TableRow key={mov.id}>
                            <TableCell>
                              {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                              <br />
                              <span className="text-xs text-gray-600">
                                {new Date(mov.created_at).toLocaleTimeString('pt-BR')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{produto?.nome || 'Produto não encontrado'}</p>
                                <p className="text-xs text-gray-600">
                                  Estoque: {mov.quantidade_anterior} → {mov.quantidade_atual}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${tipoInfo.color} gap-1`}>
                                <TipoIcon className="w-3 h-3" />
                                {tipoInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${mov.quantidade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {mov.quantidade >= 0 ? '+' : ''}{mov.quantidade}
                              </span>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{mov.motivo}</p>
                              {mov.observacoes && (
                                <p className="text-xs text-gray-600 mt-1">{mov.observacoes}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{mov.created_by || 'Sistema'}</p>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Movimentação */}
      {showMovimentacaoForm && selectedProduto && (
        <MovimentacaoEstoqueForm
          produto={selectedProduto}
          fornecedor={fornecedores.find(f => f.id === selectedProduto.fornecedor_id)}
          onClose={() => {
            setShowMovimentacaoForm(false);
            setSelectedProduto(null);
          }}
          onSuccess={() => {
            setShowMovimentacaoForm(false);
            setSelectedProduto(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}