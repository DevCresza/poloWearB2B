import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Package, TrendingUp, Calendar, Filter, Download,
  Search, BarChart3, DollarSign, ShoppingCart, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime } from '@/utils/exportUtils';

export default function HistoricoCompras() {
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [sugestoesIA, setSugestoesIA] = useState(null);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);

  const [stats, setStats] = useState({
    totalComprado: 0,
    totalPedidos: 0,
    ticketMedio: 0,
    produtosMaisComprados: [],
    comprasPorMes: [],
    comprasPorFornecedor: [],
    categoriasMaisCompradas: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [pedidosList, produtosList, fornecedoresList] = await Promise.all([
        Pedido.filter({ 
          comprador_user_id: currentUser.id,
          status: 'finalizado'
        }, '-created_date'),
        Produto.list(),
        Fornecedor.list()
      ]);

      setPedidos(pedidosList || []);
      setProdutos(produtosList || []);
      setFornecedores(fornecedoresList || []);

      calculateStats(pedidosList, produtosList);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (pedidosList, produtosList) => {
    const totalComprado = pedidosList.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const totalPedidos = pedidosList.length;
    const ticketMedio = totalPedidos > 0 ? totalComprado / totalPedidos : 0;

    // Produtos mais comprados
    const produtosMap = {};
    pedidosList.forEach(pedido => {
      try {
        const itens = Array.isArray(pedido.itens) ? pedido.itens : JSON.parse(pedido.itens);
        itens.forEach(item => {
          if (!produtosMap[item.produto_id]) {
            produtosMap[item.produto_id] = {
              nome: item.nome,
              quantidade: 0,
              valor_total: 0,
              ultima_compra: pedido.created_date
            };
          }
          produtosMap[item.produto_id].quantidade += item.quantidade;
          produtosMap[item.produto_id].valor_total += item.total;
          
          // Atualizar última compra
          if (new Date(pedido.created_date) > new Date(produtosMap[item.produto_id].ultima_compra)) {
            produtosMap[item.produto_id].ultima_compra = pedido.created_date;
          }
        });
      } catch (e) {
      }
    });

    const produtosMaisComprados = Object.entries(produtosMap)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    // Compras por mês (últimos 12 meses)
    const comprasPorMes = [];
    for (let i = 11; i >= 0; i--) {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      const mes = data.getMonth();
      const ano = data.getFullYear();

      const pedidosMes = pedidosList.filter(p => {
        const dataPedido = new Date(p.created_date);
        return dataPedido.getMonth() === mes && dataPedido.getFullYear() === ano;
      });

      comprasPorMes.push({
        mes: data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: pedidosMes.reduce((sum, p) => sum + (p.valor_total || 0), 0),
        pedidos: pedidosMes.length
      });
    }

    // Compras por fornecedor
    const fornecedorMap = {};
    pedidosList.forEach(pedido => {
      if (!fornecedorMap[pedido.fornecedor_id]) {
        fornecedorMap[pedido.fornecedor_id] = {
          valor: 0,
          pedidos: 0
        };
      }
      fornecedorMap[pedido.fornecedor_id].valor += pedido.valor_total || 0;
      fornecedorMap[pedido.fornecedor_id].pedidos += 1;
    });

    const comprasPorFornecedor = Object.entries(fornecedorMap).map(([id, data]) => ({
      fornecedor_id: id,
      nome: fornecedores.find(f => f.id === id)?.nome_marca || 'N/A',
      ...data
    }));

    // Categorias mais compradas
    const categoriaMap = {};
    pedidosList.forEach(pedido => {
      try {
        const itens = Array.isArray(pedido.itens) ? pedido.itens : JSON.parse(pedido.itens);
        itens.forEach(item => {
          const produto = produtosList.find(p => p.id === item.produto_id);
          if (produto && produto.categoria) {
            if (!categoriaMap[produto.categoria]) {
              categoriaMap[produto.categoria] = 0;
            }
            categoriaMap[produto.categoria] += item.quantidade;
          }
        });
      } catch (e) {
      }
    });

    const categoriasMaisCompradas = Object.entries(categoriaMap)
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    setStats({
      totalComprado,
      totalPedidos,
      ticketMedio,
      produtosMaisComprados,
      comprasPorMes,
      comprasPorFornecedor,
      categoriasMaisCompradas
    });
  };

  const gerarSugestoesIA = async () => {
    setLoadingSugestoes(true);
    try {
      // Analisar padrões de compra
      const produtosNaoCompradosRecentemente = stats.produtosMaisComprados
        .filter(p => {
          const diasDesdeUltimaCompra = Math.floor(
            (new Date() - new Date(p.ultima_compra)) / (1000 * 60 * 60 * 24)
          );
          return diasDesdeUltimaCompra > 60; // 2 meses
        })
        .map(p => p.nome);

      const categoriasPreferidas = stats.categoriasMaisCompradas
        .slice(0, 3)
        .map(c => c.categoria);

      const prompt = `
        Você é um assistente de compras especializado em moda multimarca.
        
        Analise o histórico de compras do cliente:
        - Total comprado: R$ ${stats.totalComprado.toFixed(2)}
        - Ticket médio: R$ ${stats.ticketMedio.toFixed(2)}
        - Produtos favoritos: ${stats.produtosMaisComprados.slice(0, 5).map(p => p.nome).join(', ')}
        - Categorias preferidas: ${categoriasPreferidas.join(', ')}
        - Produtos não comprados há mais de 2 meses: ${produtosNaoCompradosRecentemente.join(', ')}
        
        Gere 5 sugestões personalizadas de produtos que o cliente deveria considerar comprar,
        explicando o motivo de cada sugestão baseado no histórico.
        
        Responda APENAS com um JSON no formato:
        {
          "sugestoes": [
            {
              "produto": "nome do produto",
              "motivo": "explicação clara e comercial do porquê comprar",
              "categoria": "categoria do produto"
            }
          ]
        }
      `;

      const response = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            sugestoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  produto: { type: "string" },
                  motivo: { type: "string" },
                  categoria: { type: "string" }
                }
              }
            }
          }
        }
      });

      setSugestoesIA(response);
    } catch (error) {
      toast.info('Não foi possível gerar sugestões no momento.');
    } finally {
      setLoadingSugestoes(false);
    }
  };

  const filteredPedidos = pedidos.filter(pedido => {
    const matchesFornecedor = filtroFornecedor === 'todos' || pedido.fornecedor_id === filtroFornecedor;
    
    let matchesPeriodo = true;
    if (periodoInicio && periodoFim) {
      const dataPedido = new Date(pedido.created_date);
      const inicio = new Date(periodoInicio);
      const fim = new Date(periodoFim);
      matchesPeriodo = dataPedido >= inicio && dataPedido <= fim;
    }

    let matchesSearch = true;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      matchesSearch = pedido.id.toLowerCase().includes(search);
    }

    return matchesFornecedor && matchesPeriodo && matchesSearch;
  });

  const getFornecedorNome = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    return fornecedor?.nome_marca || 'N/A';
  };

  const handleExport = async (format) => {
    try {
      // Preparar dados para exportação
      const exportData = filteredPedidos.map(pedido => ({
        id: pedido.id.substring(0, 8),
        data: formatDateTime(pedido.created_date),
        fornecedor: getFornecedorNome(pedido.fornecedor_id),
        status: pedido.status,
        status_pagamento: pedido.status_pagamento,
        valor_total: pedido.valor_total,
        valor_final: pedido.valor_final,
        metodo_pagamento: pedido.metodo_pagamento || 'Não informado'
      }));

      // Definir colunas
      const columns = [
        { key: 'id', label: 'ID Pedido' },
        { key: 'data', label: 'Data' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'status', label: 'Status' },
        { key: 'status_pagamento', label: 'Pagamento' },
        { key: 'valor_total', label: 'Valor Total' },
        { key: 'valor_final', label: 'Valor Final' },
        { key: 'metodo_pagamento', label: 'Método Pagamento' }
      ];

      if (format === 'pdf') {
        await exportToPDF(
          exportData,
          columns,
          `Histórico de Compras - ${user?.empresa || user?.full_name || 'Cliente'}`,
          `historico_compras_${new Date().toISOString().split('T')[0]}.pdf`
        );
      } else if (format === 'csv') {
        exportToCSV(
          exportData,
          columns,
          `historico_compras_${new Date().toISOString().split('T')[0]}.csv`
        );
      }
    } catch (error) {
      toast.error('Erro ao exportar dados.');
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Compras</h1>
          <p className="text-gray-600">Analise seu histórico e padrões de compra</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleExport('pdf')}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            onClick={() => handleExport('csv')}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={gerarSugestoesIA}
            disabled={loadingSugestoes}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {loadingSugestoes ? 'Gerando...' : 'Sugestões IA'}
          </Button>
        </div>
      </div>

      {/* Sugestões da IA */}
      {sugestoesIA && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Sparkles className="w-5 h-5" />
              Sugestões Personalizadas por IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sugestoesIA.sugestoes?.map((sugestao, index) => (
                <div key={index} className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{sugestao.produto}</h3>
                      <p className="text-sm text-gray-600 mb-2">{sugestao.motivo}</p>
                      <Badge variant="outline">{sugestao.categoria}</Badge>
                    </div>
                    <Button size="sm" className="ml-4">
                      Ver no Catálogo
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">Total Comprado</p>
            <p className="text-3xl font-bold text-gray-900">
              R$ {stats.totalComprado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Total de Pedidos</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalPedidos}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-sm text-gray-600">Ticket Médio</p>
            <p className="text-3xl font-bold text-gray-900">
              R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="faturamento" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="faturamento" className="space-y-4">
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Evolução de Compras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.comprasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="valor" stroke="#3b82f6" name="Valor (R$)" />
                  <Line type="monotone" dataKey="pedidos" stroke="#10b981" name="Pedidos" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardHeader>
              <CardTitle>Compras por Fornecedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.comprasPorFornecedor.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div>
                      <p className="font-semibold">{item.nome}</p>
                      <p className="text-sm text-gray-600">{item.pedidos} pedidos</p>
                    </div>
                    <p className="font-bold text-green-600">
                      {formatCurrency(item.valor)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produtos">
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Produtos Mais Comprados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.produtosMaisComprados.map((produto, index) => {
                  const diasDesdeUltimaCompra = Math.floor(
                    (new Date() - new Date(produto.ultima_compra)) / (1000 * 60 * 60 * 24)
                  );
                  const alertaRecompra = diasDesdeUltimaCompra > 60;

                  return (
                    <div key={produto.id} className="flex items-center justify-between p-4 bg-white rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{produto.nome}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{produto.quantidade} unidades</span>
                            <span>•</span>
                            <span>Última compra: {new Date(produto.ultima_compra).toLocaleDateString('pt-BR')}</span>
                            {alertaRecompra && (
                              <Badge className="bg-orange-100 text-orange-800">
                                Reabastecer
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="font-bold text-green-600">
                        {formatCurrency(produto.valor_total)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
              <CardHeader>
                <CardTitle>Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.categoriasMaisCompradas}
                      dataKey="quantidade"
                      nameKey="categoria"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {stats.categoriasMaisCompradas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
              <CardHeader>
                <CardTitle>Categorias em Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.categoriasMaisCompradas.map((cat, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div className="flex-1">
                        <p className="font-semibold">{cat.categoria}</p>
                        <p className="text-sm text-gray-600">{cat.quantidade} itens comprados</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Filtros */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os fornecedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os fornecedores</SelectItem>
                {fornecedores.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia || f.nome_marca}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              placeholder="Data Início"
            />

            <Input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              placeholder="Data Fim"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader>
          <CardTitle>Pedidos Finalizados ({filteredPedidos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPedidos.map(pedido => (
              <div key={pedido.id} className="flex items-center justify-between p-4 bg-white rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold">#{pedido.id.slice(-8).toUpperCase()}</p>
                  <p className="text-sm text-gray-600">
                    {getFornecedorNome(pedido.fornecedor_id)} • {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(pedido.valor_total)}</p>
                  <Badge className="bg-green-100 text-green-800 mt-1">
                    Finalizado
                  </Badge>
                </div>
              </div>
            ))}

            {filteredPedidos.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum pedido encontrado com os filtros selecionados</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}