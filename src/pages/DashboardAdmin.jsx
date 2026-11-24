
import { useState, useEffect } from 'react';
import { Meta } from '@/api/entities';
import { kpisDashboard, kpisDashboardAdmin, porStatus } from '@/api/kpis';
import { anoMesBR, hojeBR, somarDiasISO } from '@/utils/dataBR';
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
import { exportToCSV, formatCurrency, formatDate } from '@/utils/exportUtils';

// 'YYYY-MM' de uma data (para casar com o mês de faturamento dos pedidos).
const chaveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
import DashboardKpiCards from '../components/DashboardKpiCards';

// Status que contam como faturamento nos cards (inclui parcialmente_faturado;
// os graficos nao incluem -- duas listas, como sempre foi).
const FATURAMENTO_STATUSES = ['faturado', 'parcialmente_faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'];

export default function DashboardAdmin() {
  const [loading, setLoading] = useState(true);
  const [metas, setMetas] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState(anoMesBR().mes);
  const [anoSelecionado, setAnoSelecionado] = useState(anoMesBR().ano);

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
    qtdFaturada: 0,
    valorFaturado: 0,
    valorQuebraTotal: 0,
    saldoPendente: 0,
    valorTotalPedidos: 0,
    clientesAtivos: 0,
    clientesBloqueados: 0,
    clientesNovos: 0,
    valorEmAberto: 0,
    valorAVencer: 0,
    valorVencido: 0,
    valorSemVencimento: 0,
    qtdSemVencimento: 0,
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

  // Antes esta tela baixava pedidos.* inteiro (com o itens), produtos, users,
  // carteira e fornecedores -- cerca de 90 MB -- para somar no navegador. As
  // contas agora rodam no banco (kpis_dashboard + kpis_dashboard_admin, ver a
  // migration 20261123233919) e voltam so os numeros, com a mesma regra.
  const loadData = async () => {
    setLoading(true);
    try {
      const [kpis, adm, metasList] = await Promise.all([
        kpisDashboard(),
        kpisDashboardAdmin(),
        Meta.filter({ ano: anoSelecionado, mes: mesSelecionado })
      ]);

      setMetas(metasList || []);

      // Faturamento por mes de faturamento ('YYYY-MM' -> valores F4/F5).
      const porMes = {};
      (adm?.por_mes || []).forEach(m => { porMes[m.mes] = m; });

      calculateStats(kpis, adm, porMes);
      generateChartData(kpis, adm, porMes);

      setPedidosAtrasados({
        total: Number(adm?.atrasados_total) || 0,
        detalhes: adm?.atrasados || []
      });

    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (kpis, adm, porMes) => {
    const st = porStatus(kpis);
    const mesAnterior = new Date(anoSelecionado, mesSelecionado - 2, 1);

    // Faturamento - pedidos faturados, em transporte, pendente de pagamento e
    // finalizados (valor_faturado real, nao valor_final/valor_total).
    const faturamentoTotal = st.soma(FATURAMENTO_STATUSES, 'valor_faturado');
    const qtdFaturamento = st.qtd(FATURAMENTO_STATUSES);

    // Escopo do mês por MÊS DE FATURAMENTO (NF, senão cápsula), não pela data
    // do pedido — o seletor de mês/ano representa o mês em que se fatura.
    const chaveMesSel = `${anoSelecionado}-${String(mesSelecionado).padStart(2, '0')}`;
    const chaveMesAnt = chaveMes(mesAnterior);

    const faturamentoMes = Number(porMes[chaveMesSel]?.valor_f5) || 0;
    const pedidosMes = Number(porMes[chaveMesSel]?.qtd_f5) || 0;
    const faturamentoMesAnterior = Number(porMes[chaveMesAnt]?.valor_f5) || 0;

    const crescimentoMensal = faturamentoMesAnterior > 0
      ? ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
      : 0;

    // Pedidos (excluir cancelados do total)
    const naoCancelados = st.exceto('cancelado');
    const pedidosTotal = st.qtd(naoCancelados);
    const pedidosEmAnalise = st.qtd(['novo_pedido', 'em_analise']);
    const pedidosEmProducao = st.qtd(['em_producao']);
    const pedidosFaturados = st.qtd(['faturado']);

    // Clientes
    const clientesAtivos = Number(adm?.clientes_ativos) || 0;
    const clientesBloqueados = Number(adm?.clientes_bloqueados) || 0;
    // Clientes cadastrados nos ultimos 30 dias (users.created_at). Ate a T15
    // dava sempre 0: a conta lia users.created_date, que nao existe.
    const clientesNovos = Number(adm?.clientes_novos) || 0;

    // Quebra total, saldo pendente (o que falta faturar) e valor total
    const valorQuebraTotal = st.soma('*', 'valor_quebra');
    const statusPendentes = ['em_producao', 'parcialmente_faturado'];
    const saldoPendente = st.soma(statusPendentes, 'valor_total')
      - st.soma(statusPendentes, 'valor_faturado')
      - st.soma(statusPendentes, 'valor_quebra');
    const valorTotalPedidos = st.soma(naoCancelados, 'valor_total');

    // Financeiro (titulos pendentes)
    const valorEmAberto = Number(kpis?.carteira?.em_aberto) || 0;
    const valorAVencer = Number(kpis?.carteira?.a_vencer) || 0;
    const valorVencido = Number(kpis?.carteira?.vencido) || 0;
    // Titulo pendente sem data de vencimento: nem vencido nem a vencer.
    const valorSemVencimento = Number(kpis?.carteira?.sem_vencimento) || 0;
    const qtdSemVencimento = Number(kpis?.carteira?.qtd_sem_vencimento) || 0;

    // Produtos
    const produtosAtivos = Number(kpis?.produtos?.ativos) || 0;
    const produtosEstoqueBaixo = Number(kpis?.produtos?.estoque_baixo) || 0;

    // Ticket Médio (baseado no valor faturado)
    const ticketMedio = qtdFaturamento > 0 ? faturamentoTotal / qtdFaturamento : 0;

    setStats({
      faturamentoTotal,
      faturamentoMes,
      crescimentoMensal,
      pedidosTotal,
      pedidosMes,
      pedidosEmAnalise,
      pedidosEmProducao,
      pedidosFaturados,
      qtdFaturada: qtdFaturamento,
      valorFaturado: faturamentoTotal,
      valorQuebraTotal,
      saldoPendente,
      valorTotalPedidos,
      clientesAtivos,
      clientesBloqueados,
      clientesNovos,
      valorEmAberto,
      valorAVencer,
      valorVencido,
      valorSemVencimento,
      qtdSemVencimento,
      produtosAtivos,
      produtosEstoqueBaixo,
      ticketMedio
    });
  };

  const generateChartData = (kpis, adm, porMes) => {
    const st = porStatus(kpis);

    // Faturamento Mensal (últimos 12 meses) — por MÊS DE FATURAMENTO, a
    // partir do mes corrente em Brasilia. (setMonth num dia 31 pulava meses.)
    const faturamentoMensal = [];
    const atual = anoMesBR();
    for (let i = 11; i >= 0; i--) {
      const mes = new Date(atual.ano, atual.mes - 1 - i, 1);
      const m = porMes[chaveMes(mes)];

      faturamentoMensal.push({
        mes: mes.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        valor: Number(m?.valor_f4) || 0,
        pedidos: Number(m?.qtd_f4) || 0
      });
    }

    // Pedidos por Status
    const statusCounts = {
      'Novos': st.qtd(['novo_pedido']),
      'Em Análise': st.qtd(['em_analise']),
      'Aprovados': st.qtd(['aprovado']),
      'Em Produção': st.qtd(['em_producao']),
      'Faturados': st.qtd(['faturado']),
      'Em Transporte': st.qtd(['em_transporte']),
      'Aguardando Pagamento': st.qtd(['pendente_pagamento']),
      'Finalizados': st.qtd(['finalizado'])
    };

    const pedidosPorStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));

    const numeros = (lista) => (lista || []).map(x => ({
      ...x,
      valor: Number(x.valor) || 0,
      ...(x.pedidos != null ? { pedidos: Number(x.pedidos) || 0 } : {}),
      ...(x.quantidade != null ? { quantidade: Number(x.quantidade) || 0 } : {})
    }));

    // Faturamento por fornecedor, top 10 clientes e top 10 produtos: ja vem
    // filtrados (> 0) e ordenados do banco.
    const faturamentoPorFornecedor = numeros(adm?.por_fornecedor);
    const topClientes = numeros(adm?.top_clientes);
    const produtosMaisVendidos = numeros(adm?.mais_vendidos);

    // Evolução de Pedidos (últimos 30 dias, excluindo cancelados)
    const porDia = {};
    (adm?.evolucao || []).forEach(d => { porDia[String(d.dia).slice(0, 10)] = d; });
    const evolucaoPedidos = [];
    const hoje = hojeBR();
    for (let i = 29; i >= 0; i--) {
      // Dias de Brasilia, os mesmos do banco (kpis_dashboard_admin).
      const diaISO = somarDiasISO(hoje, -i);
      const d = porDia[diaISO];

      evolucaoPedidos.push({
        dia: `${diaISO.slice(8, 10)}/${diaISO.slice(5, 7)}`,
        pedidos: Number(d?.pedidos) || 0,
        valor: Number(d?.valor) || 0
      });
    }

    setChartData({
      faturamentoMensal,
      pedidosPorStatus,
      faturamentoPorFornecedor,
      topClientes,
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
          {/* KPIs Padronizados (6 cards) */}
          <DashboardKpiCards
            role="admin"
            kpis={{
              totalPedidos: stats.pedidosTotal,
              valorTotal: stats.valorTotalPedidos,
              valorFaturado: stats.valorFaturado,
              qtdFaturada: stats.qtdFaturada,
              pendenteFaturamento: stats.saldoPendente,
              qtdPendenteFaturamento: stats.pedidosTotal - stats.qtdFaturada,
              valorAVencer: stats.valorAVencer,
              valorVencido: stats.valorVencido,
              valorSemVencimento: stats.valorSemVencimento,
              qtdSemVencimento: stats.qtdSemVencimento,
              valorQuebra: stats.valorQuebraTotal,
            }}
          />

          {/* KPIs Admin-Específicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  Ticket médio: R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
