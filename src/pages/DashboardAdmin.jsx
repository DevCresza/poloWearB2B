
import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Meta } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, AlertTriangle,
  Calendar, BarChart3, PieChart as PieChartIcon, Download, Target, Clock
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { exportToCSV, formatCurrency, formatDate } from '@/utils/exportUtils';

export default function DashboardAdmin() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carteira, setCarteira] = useState([]);
  const [metas, setMetas] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [pedidosAtrasados, setPedidosAtrasados] = useState({
    total: 0,
    detalhes: []
  });

  const [stats, setStats] = useState({
    faturamentoTotal: 0,
    faturamentoMes: 0,
    crescimentoMensal: 0,
    pedidosTotal: 0,
    pedidosMes: 0,
    pedidosEmAnalise: 0,
    pedidosEmProducao: 0,
    pedidosFaturados: 0,
    clientesAtivos: 0,
    clientesBloqueados: 0,
    clientesNovos: 0,
    valorEmAberto: 0,
    valorVencido: 0,
    produtosAtivos: 0,
    produtosEstoqueBaixo: 0,
    ticketMedio: 0
  });

  const [chartData, setChartData] = useState({
    faturamentoMensal: [],
    pedidosPorStatus: [],
    faturamentoPorFornecedor: [],
    topClientes: [],
    produtosMaisVendidos: [],
    evolucaoPedidos: []
  });

  useEffect(() => {
    loadData();
  }, [mesSelecionado, anoSelecionado]); // Using original dependencies [mesSelecionado, anoSelecionado]

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        pedidosList,
        produtosList,
        fornecedoresList,
        clientesList,
        carteiraList,
        metasList
      ] = await Promise.all([
        Pedido.list('-created_date'),
        Produto.list(),
        Fornecedor.list(),
        User.list(),
        Carteira.list(),
        Meta.filter({ ano: anoSelecionado, mes: mesSelecionado })
      ]);

      // Filtrar apenas clientes (multimarca e franqueado)
      const clientesFiltrados = (clientesList || []).filter(u =>
        u.tipo_negocio === 'multimarca' || u.tipo_negocio === 'franqueado' || u.categoria_cliente === 'franqueado'
      );

      setPedidos(pedidosList || []);
      setProdutos(produtosList || []);
      setFornecedores(fornecedoresList || []);
      setClientes(clientesFiltrados);
      setCarteira(carteiraList || []);
      setMetas(metasList || []);

      calculateStats(pedidosList, produtosList, clientesFiltrados, carteiraList);
      generateChartData(pedidosList, fornecedoresList, clientesFiltrados);

      // Carregar pedidos atrasados
      const hoje = new Date();

      const atrasados = pedidosList.filter(pedido => {
        // Pedidos aprovados há mais de 7 dias que não foram faturados
        if (pedido.status === 'aprovado' && pedido.data_aprovacao) {
          const dataAprovacao = new Date(pedido.data_aprovacao);
          const diasDesdeAprovacao = Math.floor((hoje - dataAprovacao) / (1000 * 60 * 60 * 24));
          return diasDesdeAprovacao > 7;
        }

        // Pedidos em produção há mais de 15 dias
        if (pedido.status === 'em_producao') {
          const dataCriacao = new Date(pedido.created_date); // Assuming created_date as the relevant start date for this calculation
          const diasDesdeCriacao = Math.floor((hoje - dataCriacao) / (1000 * 60 * 60 * 24));
          return diasDesdeCriacao > 15;
        }

        // Pedidos faturados há mais de 5 dias que não foram enviados
        if (pedido.status === 'faturado' && pedido.nf_data_upload) {
          const dataFaturamento = new Date(pedido.nf_data_upload);
          const diasDesdeFaturamento = Math.floor((hoje - dataFaturamento) / (1000 * 60 * 60 * 24));
          // Assuming 'faturado' means it's ready to be sent, and needs to be in a later status like 'em_transporte' or 'finalizado' to be considered 'sent'.
          // So if status is still 'faturado' and days since nf_data_upload > 5, it's atrasado.
          return diasDesdeFaturamento > 5;
        }

        return false;
      });

      const atrasadosDetalhados = atrasados.map(pedido => {
        const fornecedor = fornecedoresList.find(f => f.id === pedido.fornecedor_id);
        const cliente = clientesList.find(c => c.id === pedido.comprador_user_id);
        return {
          ...pedido,
          fornecedor_nome: fornecedor?.nome_marca || 'Desconhecido',
          cliente_nome: cliente?.empresa || cliente?.razao_social || cliente?.nome_marca || cliente?.full_name || 'Desconhecido'
        };
      });

      setPedidosAtrasados({
        total: atrasados.length,
        detalhes: atrasadosDetalhados
      });

    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (pedidosList, produtosList, clientesList, carteiraList) => {
    const hoje = new Date();
    const inicioMes = new Date(anoSelecionado, mesSelecionado - 1, 1);
    const fimMes = new Date(anoSelecionado, mesSelecionado, 0);
    const mesAnterior = new Date(anoSelecionado, mesSelecionado - 2, 1);
    const fimMesAnterior = new Date(anoSelecionado, mesSelecionado - 1, 0);

    // Faturamento - considerar pedidos finalizados OU faturados OU em transporte para ter mais dados
    const pedidosParaFaturamento = pedidosList.filter(p =>
      ['finalizado', 'faturado', 'em_transporte'].includes(p.status)
    );
    const faturamentoTotal = pedidosParaFaturamento.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

    const pedidosMes = pedidosParaFaturamento.filter(p => {
      const data = new Date(p.created_date);
      return data >= inicioMes && data <= fimMes;
    });
    const faturamentoMes = pedidosMes.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

    const pedidosMesAnterior = pedidosParaFaturamento.filter(p => {
      const data = new Date(p.created_date);
      return data >= mesAnterior && data <= fimMesAnterior;
    });
    const faturamentoMesAnterior = pedidosMesAnterior.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

    const crescimentoMensal = faturamentoMesAnterior > 0
      ? ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
      : 0;

    // Pedidos
    const pedidosTotal = pedidosList.length;
    const pedidosEmAnalise = pedidosList.filter(p => ['novo_pedido', 'em_analise'].includes(p.status)).length;
    const pedidosEmProducao = pedidosList.filter(p => p.status === 'em_producao').length;
    const pedidosFaturados = pedidosList.filter(p => p.status === 'faturado').length;

    // Clientes
    const clientesAtivos = clientesList.filter(c => !c.bloqueado).length;
    const clientesBloqueados = clientesList.filter(c => c.bloqueado).length;
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    const clientesNovos = clientesList.filter(c => new Date(c.created_date) >= trintaDiasAtras).length;

    // Financeiro
    const valorEmAberto = carteiraList
      .filter(t => t.status === 'pendente')
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    const valorVencido = carteiraList
      .filter(t => {
        const vencimento = new Date(t.data_vencimento);
        return t.status === 'pendente' && vencimento < hoje;
      })
      .reduce((sum, t) => sum + (t.valor || 0), 0);

    // Produtos
    const produtosAtivos = produtosList.filter(p => p.ativo).length;
    const produtosEstoqueBaixo = produtosList.filter(p =>
      p.controla_estoque && p.estoque_atual_grades <= p.estoque_minimo_grades
    ).length;

    // Ticket Médio
    const ticketMedio = pedidosParaFaturamento.length > 0
      ? faturamentoTotal / pedidosParaFaturamento.length
      : 0;

    setStats({
      faturamentoTotal,
      faturamentoMes,
      crescimentoMensal,
      pedidosTotal,
      pedidosMes: pedidosMes.length,
      pedidosEmAnalise,
      pedidosEmProducao,
      pedidosFaturados,
      clientesAtivos,
      clientesBloqueados,
      clientesNovos,
      valorEmAberto,
      valorVencido,
      produtosAtivos,
      produtosEstoqueBaixo,
      ticketMedio
    });
  };

  const generateChartData = (pedidosList, fornecedoresList, clientesList) => {
    // Status considerados para faturamento
    const statusFaturamento = ['finalizado', 'faturado', 'em_transporte', 'pendente_pagamento'];

    // Faturamento Mensal (últimos 12 meses)
    const faturamentoMensal = [];
    for (let i = 11; i >= 0; i--) {
      const mes = new Date();
      mes.setMonth(mes.getMonth() - i);
      const inicioMes = new Date(mes.getFullYear(), mes.getMonth(), 1);
      const fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);

      const pedidosMes = pedidosList.filter(p => {
        if (!statusFaturamento.includes(p.status)) return false;
        const data = new Date(p.created_date);
        return data >= inicioMes && data <= fimMes;
      });

      const valor = pedidosMes.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

      faturamentoMensal.push({
        mes: mes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: valor,
        pedidos: pedidosMes.length
      });
    }

    // Pedidos por Status
    const statusCounts = {
      'Novos': pedidosList.filter(p => p.status === 'novo_pedido').length,
      'Em Análise': pedidosList.filter(p => p.status === 'em_analise').length,
      'Aprovados': pedidosList.filter(p => p.status === 'aprovado').length,
      'Em Produção': pedidosList.filter(p => p.status === 'em_producao').length,
      'Faturados': pedidosList.filter(p => p.status === 'faturado').length,
      'Em Transporte': pedidosList.filter(p => p.status === 'em_transporte').length,
      'Aguardando Pagamento': pedidosList.filter(p => p.status === 'pendente_pagamento').length,
      'Finalizados': pedidosList.filter(p => p.status === 'finalizado').length
    };

    const pedidosPorStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));

    // Faturamento por Fornecedor
    const faturamentoPorFornecedor = fornecedoresList.map(fornecedor => {
      const pedidosFornecedor = pedidosList.filter(p =>
        p.fornecedor_id === fornecedor.id && statusFaturamento.includes(p.status)
      );
      const valor = pedidosFornecedor.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

      return {
        nome: fornecedor.nome_marca || fornecedor.razao_social || fornecedor.nome_fantasia,
        valor: valor,
        pedidos: pedidosFornecedor.length
      };
    }).filter(f => f.valor > 0).sort((a, b) => b.valor - a.valor);

    // Top Clientes
    const clientesComFaturamento = clientesList.map(cliente => {
      const pedidosCliente = pedidosList.filter(p =>
        p.comprador_user_id === cliente.id && statusFaturamento.includes(p.status)
      );
      const valor = pedidosCliente.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

      return {
        nome: cliente.empresa || cliente.razao_social || cliente.nome_marca || cliente.full_name,
        valor: valor,
        pedidos: pedidosCliente.length
      };
    }).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 10);

    // Produtos Mais Vendidos
    const produtosVendidos = {};
    pedidosList.filter(p => statusFaturamento.includes(p.status)).forEach(pedido => {
      try {
        const itens = Array.isArray(pedido.itens) ? pedido.itens : JSON.parse(pedido.itens);
        itens.forEach(item => {
          const key = item.nome;
          if (!produtosVendidos[key]) {
            produtosVendidos[key] = { nome: item.nome, quantidade: 0, valor: 0 };
          }
          produtosVendidos[key].quantidade += item.quantidade || 0;
          produtosVendidos[key].valor += (item.preco * item.quantidade) || 0;
        });
      } catch (_e) {
      }
    });

    const produtosMaisVendidos = Object.values(produtosVendidos)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    // Evolução de Pedidos (últimos 30 dias)
    const evolucaoPedidos = [];
    for (let i = 29; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const inicioDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
      const fimDia = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);

      const pedidosDia = pedidosList.filter(p => {
        const data = new Date(p.created_date);
        return data >= inicioDia && data <= fimDia;
      });

      evolucaoPedidos.push({
        dia: dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        pedidos: pedidosDia.length,
        valor: pedidosDia.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0)
      });
    }

    setChartData({
      faturamentoMensal,
      pedidosPorStatus,
      faturamentoPorFornecedor,
      topClientes: clientesComFaturamento,
      produtosMaisVendidos,
      evolucaoPedidos
    });
  };

  const exportarRelatorio = async () => {
    try {
      // Preparar dados para exportação CSV
      const exportData = [];

      // Adicionar KPIs principais
      exportData.push({
        tipo: 'KPI',
        indicador: 'Faturamento Total',
        valor: stats.faturamentoTotal,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });
      exportData.push({
        tipo: 'KPI',
        indicador: 'Total de Pedidos',
        valor: stats.totalPedidos,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });
      exportData.push({
        tipo: 'KPI',
        indicador: 'Ticket Médio',
        valor: stats.ticketMedio,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });
      exportData.push({
        tipo: 'KPI',
        indicador: 'Clientes Ativos',
        valor: stats.clientesAtivos,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });
      exportData.push({
        tipo: 'KPI',
        indicador: 'Pedidos Pendentes',
        valor: stats.pedidosPendentes,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });
      exportData.push({
        tipo: 'KPI',
        indicador: 'Valor em Aberto',
        valor: stats.valorEmAberto,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });
      exportData.push({
        tipo: 'KPI',
        indicador: 'Valor Vencido',
        valor: stats.valorVencido,
        periodo: `${mesSelecionado}/${anoSelecionado}`
      });

      // Adicionar dados de evolução
      if (chartData.evolucaoPedidos && chartData.evolucaoPedidos.length > 0) {
        chartData.evolucaoPedidos.forEach(item => {
          exportData.push({
            tipo: 'Evolução Mensal',
            indicador: item.mes,
            valor: item.valor,
            periodo: `${anoSelecionado}`
          });
        });
      }

      // Adicionar produtos mais vendidos
      if (chartData.produtosMaisVendidos && chartData.produtosMaisVendidos.length > 0) {
        chartData.produtosMaisVendidos.forEach(item => {
          exportData.push({
            tipo: 'Produto Mais Vendido',
            indicador: item.nome,
            valor: item.quantidade,
            periodo: `${mesSelecionado}/${anoSelecionado}`
          });
        });
      }

      // Definir colunas para CSV
      const columns = [
        { key: 'tipo', label: 'Tipo' },
        { key: 'indicador', label: 'Indicador' },
        { key: 'valor', label: 'Valor' },
        { key: 'periodo', label: 'Período' }
      ];

      // Exportar CSV
      exportToCSV(
        exportData,
        columns,
        `relatorio-dashboard-${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}.csv`
      );

      toast.success('Relatório exportado com sucesso!');
    } catch (_error) {
      toast.error('Erro ao exportar relatório');
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <div className="space-y-8"> {/* Changed from space-y-6 */}
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
        .recharts-wrapper { font-size: 12px; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard Administrativo</h1>
          <p className="text-gray-600">Visão completa do desempenho do negócio</p>
        </div>

        <div className="flex gap-3">
          <Select value={`${mesSelecionado}`} onValueChange={(value) => setMesSelecionado(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                <SelectItem key={mes} value={`${mes}`}>
                  {new Date(2024, mes - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={`${anoSelecionado}`} onValueChange={(value) => setAnoSelecionado(parseInt(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(ano => (
                <SelectItem key={ano} value={`${ano}`}>{ano}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportarRelatorio} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl shadow-neumorphic">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-10 h-10 opacity-80" />
                  <Badge className="bg-white/20 text-white">
                    {stats.crescimentoMensal > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {Math.abs(stats.crescimentoMensal).toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-sm opacity-90 mb-1">Faturamento do Mês</p>
                <p className="text-3xl font-bold">R$ {stats.faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs opacity-75 mt-2">
                  Total: R$ {stats.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl shadow-neumorphic">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-10 h-10 opacity-80" />
                  <Badge className="bg-white/20 text-white">{stats.pedidosMes} novos</Badge>
                </div>
                <p className="text-sm opacity-90 mb-1">Total de Pedidos</p>
                <p className="text-3xl font-bold">{stats.pedidosTotal}</p>
                <div className="text-xs opacity-75 mt-2 space-y-1">
                  <p>Em análise: {stats.pedidosEmAnalise}</p>
                  <p>Em produção: {stats.pedidosEmProducao}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl shadow-neumorphic">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-10 h-10 opacity-80" />
                  <Badge className="bg-white/20 text-white">{stats.clientesNovos} novos</Badge>
                </div>
                <p className="text-sm opacity-90 mb-1">Clientes Ativos</p>
                <p className="text-3xl font-bold">{stats.clientesAtivos}</p>
                <p className="text-xs opacity-75 mt-2">
                  Bloqueados: {stats.clientesBloqueados}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl shadow-neumorphic">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-10 h-10 opacity-80" />
                  <Badge className="bg-white/20 text-white">Alerta</Badge>
                </div>
                <p className="text-sm opacity-90 mb-1">Valores Vencidos</p>
                <p className="text-3xl font-bold">R$ {stats.valorVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs opacity-75 mt-2">
                  Em aberto: R$ {stats.valorEmAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            {/* KPI de Pedidos Atrasados - NOVO */}
            <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200 rounded-2xl shadow-neumorphic">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Pedidos Atrasados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-700">{pedidosAtrasados.total}</div>
                <p className="text-xs text-red-600 mt-1">
                  Necessitam atenção imediata
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detalhamento de Pedidos Atrasados - NOVO */}
          {pedidosAtrasados.total > 0 && (
            <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Detalhamento de Pedidos Atrasados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pedidosAtrasados.detalhes.slice(0, 10).map(pedido => (
                    <div key={pedido.id} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            Pedido #{pedido.id.slice(-8).toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-600">
                            Cliente: {pedido.cliente_nome} • Fornecedor: {pedido.fornecedor_nome}
                          </p>
                          <p className="text-sm text-gray-600">
                            Status: {pedido.status} • Criado em: {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <Badge className="bg-red-600 text-white">
                          Atrasado
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {pedidosAtrasados.total > 10 && (
                  <p className="text-sm text-gray-600 mt-4 text-center">
                    E mais {pedidosAtrasados.total - 10} pedidos atrasados...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Gráficos e Análises */}
          <Tabs defaultValue="faturamento" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              <TabsTrigger value="clientes">Clientes</TabsTrigger>
              <TabsTrigger value="produtos">Produtos</TabsTrigger>
              <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
            </TabsList>

            {/* Tab: Faturamento */}
            <TabsContent value="faturamento" className="space-y-6">
              <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                <CardHeader>
                  <CardTitle>Evolução do Faturamento (Últimos 12 Meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData.faturamentoMensal}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Legend />
                      <Area type="monotone" dataKey="valor" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Faturamento" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-lg">Ticket Médio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-blue-600">
                        R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">Por pedido finalizado</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-lg">Pedidos Faturados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-green-600">{stats.pedidosFaturados}</p>
                      <p className="text-sm text-gray-600 mt-2">Aguardando envio</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Pedidos */}
            <TabsContent value="pedidos" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                  <CardHeader>
                    <CardTitle>Distribuição por Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={chartData.pedidosPorStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {chartData.pedidosPorStatus.map((entry, index) => (
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
                    <CardTitle>Evolução Diária (Últimos 30 Dias)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData.evolucaoPedidos}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="dia" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="pedidos" stroke="#3b82f6" name="Pedidos" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Clientes */}
            <TabsContent value="clientes" className="space-y-6">
              <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                <CardHeader>
                  <CardTitle>Top 10 Clientes por Faturamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.topClientes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="nome" width={150} />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Bar dataKey="valor" fill="#10b981" name="Faturamento" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Produtos */}
            <TabsContent value="produtos" className="space-y-6">
              <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                <CardHeader>
                  <CardTitle>Top 10 Produtos Mais Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.produtosMaisVendidos} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="nome" width={150} />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Bar dataKey="valor" fill="#8b5cf6" name="Faturamento" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-lg">Produtos Ativos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-blue-600">{stats.produtosAtivos}</p>
                      <p className="text-sm text-gray-600 mt-2">Total no catálogo</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Estoque Baixo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-orange-600">{stats.produtosEstoqueBaixo}</p>
                      <p className="text-sm text-gray-600 mt-2">Requer atenção</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Fornecedores */}
            <TabsContent value="fornecedores" className="space-y-6">
              <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
                <CardHeader>
                  <CardTitle>Faturamento por Fornecedor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData.faturamentoPorFornecedor}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" />
                      <YAxis />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Legend />
                      <Bar dataKey="valor" fill="#f59e0b" name="Faturamento" />
                      <Bar dataKey="pedidos" fill="#3b82f6" name="Pedidos" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Alertas e Ações Rápidas */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-red-50 border-red-200 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-5 h-5" />
                  Ações Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-sm">Pedidos em análise</span>
                  <Badge className="bg-red-600">{stats.pedidosEmAnalise}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-sm">Clientes bloqueados</span>
                  <Badge className="bg-red-600">{stats.clientesBloqueados}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-sm">Estoque baixo</span>
                  <Badge className="bg-orange-600">{stats.produtosEstoqueBaixo}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <Clock className="w-5 h-5" />
                  Em Andamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-sm">Em produção</span>
                  <Badge className="bg-yellow-600">{stats.pedidosEmProducao}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-sm">Faturados</span>
                  <Badge className="bg-yellow-600">{stats.pedidosFaturados}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="text-sm">Valor em aberto</span>
                  <Badge className="bg-yellow-600">R$ {(stats.valorEmAberto / 1000).toFixed(0)}k</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200 rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Target className="w-5 h-5" />
                  Metas do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {metas.length > 0 ? (
                  metas.slice(0, 3).map((meta, idx) => (
                    <div key={idx} className="p-2 bg-white rounded">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">{meta.tipo === 'geral' ? 'Meta Geral' : meta.tipo}</span>
                        <Badge className={
                          meta.status === 'superada' ? 'bg-green-600' :
                          meta.status === 'atingida' ? 'bg-blue-600' :
                          meta.status === 'atencao' ? 'bg-yellow-600' :
                          'bg-gray-600'
                        }>
                          {meta.percentual_valor?.toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            meta.status === 'superada' ? 'bg-green-600' :
                            meta.status === 'atingida' ? 'bg-blue-600' :
                            meta.status === 'atencao' ? 'bg-yellow-600' :
                            'bg-gray-600'
                          }`}
                          style={{ width: `${Math.min(meta.percentual_valor || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600 text-center py-4">Nenhuma meta configurada</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
