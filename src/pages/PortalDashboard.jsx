
import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Produto } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, DollarSign, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Truck, Eye, Calendar, BarChart3, FileText, X
} from 'lucide-react';
import AlertasVencimento from '../components/AlertasVencimento';
import DashboardKpiCards from '../components/DashboardKpiCards';
import { formatCurrency } from '@/utils/exportUtils';
import { useLojaContext } from '@/contexts/LojaContext';

export default function PortalDashboard() {
  const { lojaSelecionada, loading: lojasLoading } = useLojaContext();
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [carteira, setCarteira] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPedidos: 0,
    pedidosPendentes: 0,
    pedidosFinalizados: 0,
    valorTotalComprado: 0,
    qtdFaturada: 0,
    valorFaturado: 0,
    valorAVencer: 0,
    valorVencido: 0,
    produtosAtivos: 0,
    estoqueBaixo: 0
  });

  useEffect(() => {
    if (lojasLoading) return;
    loadData();
  }, [lojaSelecionada?.id, lojasLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let pedidosList = [];
      let produtosList = [];
      let carteiraList = [];

      if (currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'franqueado') {
        // Dashboard do Cliente - filter by loja if selected
        const pedidoFilter = { comprador_user_id: currentUser.id };
        const carteiraFilter = { cliente_user_id: currentUser.id };
        if (lojaSelecionada) {
          pedidoFilter.loja_id = lojaSelecionada.id;
          carteiraFilter.loja_id = lojaSelecionada.id;
        }
        pedidosList = await Pedido.filter(pedidoFilter, '-created_date', 10);
        carteiraList = await Carteira.filter(carteiraFilter);

        // Calcular estatísticas
        const FATURADO_STATUSES = ['faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'];
        const allPedidos = await Pedido.filter(pedidoFilter);
        const totalPedidos = allPedidos.length;
        const pedidosPendentes = allPedidos.filter(p =>
          ['novo_pedido', 'em_analise', 'aprovado', 'em_producao'].includes(p.status)
        ).length;
        const pedidosFinalizados = allPedidos.filter(p => p.status === 'finalizado').length;
        const valorTotalComprado = allPedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);

        const pedidosFaturados = allPedidos.filter(p => FATURADO_STATUSES.includes(p.status));
        const qtdFaturada = pedidosFaturados.length;
        const valorFaturado = pedidosFaturados.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const pendentes = carteiraList.filter(t => t.status === 'pendente');
        const valorAVencer = pendentes
          .filter(t => {
            const vencimento = new Date(t.data_vencimento);
            return vencimento >= hoje;
          })
          .reduce((sum, t) => sum + (t.valor || 0), 0);
        const valorVencido = pendentes
          .filter(t => {
            const vencimento = new Date(t.data_vencimento);
            return vencimento < hoje;
          })
          .reduce((sum, t) => sum + (t.valor || 0), 0);

        setStats({
          totalPedidos,
          pedidosPendentes,
          pedidosFinalizados,
          valorTotalComprado,
          qtdFaturada,
          valorFaturado,
          valorAVencer,
          valorVencido,
          produtosAtivos: 0,
          estoqueBaixo: 0
        });

      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Dashboard do Fornecedor
        const { Fornecedor } = await import('@/api/entities');

        // Usar fornecedor_id do usuário diretamente (se disponível)
        // ou buscar fornecedor pelo responsavel_user_id (fallback para usuários antigos)
        let fornecedorId = currentUser.fornecedor_id;
        let fornecedor = null;

        if (fornecedorId) {
          // Buscar dados do fornecedor pelo ID
          fornecedor = await Fornecedor.get(fornecedorId);
        } else {
          // Fallback: buscar fornecedor pelo responsavel_user_id
          const fornecedoresList = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
          fornecedor = fornecedoresList[0];
          if (fornecedor) {
            fornecedorId = fornecedor.id;
          }
        }

        if (fornecedor) {
          const FATURADO_STATUSES = ['faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'];
          pedidosList = await Pedido.filter({ fornecedor_id: fornecedorId }, '-created_date', 10);
          produtosList = await Produto.filter({ fornecedor_id: fornecedorId });
          carteiraList = await Carteira.filter({ fornecedor_id: fornecedorId });

          const allPedidos = await Pedido.filter({ fornecedor_id: fornecedorId });
          const totalPedidos = allPedidos.length;
          const pedidosPendentes = allPedidos.filter(p =>
            ['novo_pedido', 'em_analise'].includes(p.status)
          ).length;
          const pedidosFinalizados = allPedidos.filter(p => p.status === 'finalizado').length;
          const valorTotalComprado = allPedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);

          const pedidosFaturados = allPedidos.filter(p => FATURADO_STATUSES.includes(p.status));
          const qtdFaturada = pedidosFaturados.length;
          const valorFaturado = pedidosFaturados.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const pendentes = carteiraList.filter(t => t.status === 'pendente');
          const valorAVencer = pendentes
            .filter(t => {
              const vencimento = new Date(t.data_vencimento);
              return vencimento >= hoje;
            })
            .reduce((sum, t) => sum + (t.valor || 0), 0);
          const valorVencido = pendentes
            .filter(t => {
              const vencimento = new Date(t.data_vencimento);
              return vencimento < hoje;
            })
            .reduce((sum, t) => sum + (t.valor || 0), 0);

          const produtosAtivos = produtosList.filter(p => p.ativo).length;
          const estoqueBaixo = produtosList.filter(p =>
            p.controla_estoque &&
            p.estoque_atual_grades <= p.estoque_minimo_grades
          ).length;

          setStats({
            totalPedidos,
            pedidosPendentes,
            pedidosFinalizados,
            valorTotalComprado,
            qtdFaturada,
            valorFaturado,
            valorAVencer,
            valorVencido,
            produtosAtivos,
            estoqueBaixo
          });
        } else {
          setStats({
            totalPedidos: 0,
            pedidosPendentes: 0,
            pedidosFinalizados: 0,
            valorTotalComprado: 0,
            qtdFaturada: 0,
            valorFaturado: 0,
            valorAVencer: 0,
            valorVencido: 0,
            produtosAtivos: 0,
            estoqueBaixo: 0
          });
        }

      } else if (currentUser.role === 'admin') {
        // Dashboard Admin
        const FATURADO_STATUSES = ['faturado', 'em_transporte', 'pendente_pagamento', 'finalizado'];
        pedidosList = await Pedido.list({ sort: '-created_date', limit: 10 });
        produtosList = await Produto.list();
        carteiraList = await Carteira.list();

        const allPedidos = await Pedido.list();
        const totalPedidos = allPedidos.length;
        const pedidosPendentes = allPedidos.filter(p =>
          ['novo_pedido', 'em_analise'].includes(p.status)
        ).length;
        const pedidosFinalizados = allPedidos.filter(p => p.status === 'finalizado').length;
        const valorTotalComprado = allPedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);

        const pedidosFaturados = allPedidos.filter(p => FATURADO_STATUSES.includes(p.status));
        const qtdFaturada = pedidosFaturados.length;
        const valorFaturado = pedidosFaturados.reduce((sum, p) => sum + (p.valor_final || p.valor_total || 0), 0);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const pendentes = carteiraList.filter(t => t.status === 'pendente');
        const valorAVencer = pendentes
          .filter(t => {
            const vencimento = new Date(t.data_vencimento);
            return vencimento >= hoje;
          })
          .reduce((sum, t) => sum + (t.valor || 0), 0);
        const valorVencido = pendentes
          .filter(t => {
            const vencimento = new Date(t.data_vencimento);
            return vencimento < hoje;
          })
          .reduce((sum, t) => sum + (t.valor || 0), 0);

        const produtosAtivos = produtosList.filter(p => p.ativo).length;
        const estoqueBaixo = produtosList.filter(p =>
          p.controla_estoque &&
          p.estoque_atual_grades <= p.estoque_minimo_grades
        ).length;

        setStats({
          totalPedidos,
          pedidosPendentes,
          pedidosFinalizados,
          valorTotalComprado,
          qtdFaturada,
          valorFaturado,
          valorAVencer,
          valorVencido,
          produtosAtivos,
          estoqueBaixo
        });
      }

      setPedidos(pedidosList);
      setProdutos(produtosList);
      setCarteira(carteiraList);

    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      novo_pedido: { label: 'Novo', color: 'bg-blue-100 text-blue-800', icon: Clock },
      em_analise: { label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      em_producao: { label: 'Produção', color: 'bg-purple-100 text-purple-800', icon: Package },
      faturado: { label: 'Faturado', color: 'bg-indigo-100 text-indigo-800', icon: FileText },
      em_transporte: { label: 'Enviado', color: 'bg-orange-100 text-orange-800', icon: Truck },
      finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: X }
    };
    return statusMap[status] || statusMap.novo_pedido;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isCliente = user?.tipo_negocio === 'multimarca';
  const isFornecedor = user?.tipo_negocio === 'fornecedor';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-6">
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
        .shadow-neumorphic-inset { box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff; }
      `}</style>

      {/* Alertas de Vencimento */}
      <AlertasVencimento />

      {/* Header de Boas-Vindas */}
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 rounded-3xl shadow-neumorphic">
        <CardContent className="p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Olá, {user?.full_name}! 👋
          </h1>
          <p className="text-blue-100 text-lg">
            {isCliente && 'Bem-vindo ao seu portal de compras'}
            {isFornecedor && 'Gerencie seus produtos e pedidos'}
            {isAdmin && 'Painel administrativo completo'}
          </p>
        </CardContent>
      </Card>

      {/* Alertas Importantes */}
      {user?.bloqueado && (
        <Alert className="border-red-300 bg-red-50 rounded-2xl shadow-neumorphic">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800 font-semibold">
            Sua conta está bloqueada por inadimplência. Regularize seus pagamentos para continuar comprando.
          </AlertDescription>
        </Alert>
      )}

      {stats.valorVencido > 0 && isCliente && (
        <Alert className="border-orange-300 bg-orange-50 rounded-2xl shadow-neumorphic">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Você possui {formatCurrency(stats.valorVencido)} em títulos vencidos. 
            <Link to={createPageUrl('MeusPedidos')} className="font-semibold underline ml-2">
              Ver detalhes
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Estatísticas - 6 KPIs Padronizados */}
      <DashboardKpiCards
        role={isCliente ? 'cliente' : isFornecedor ? 'fornecedor' : 'admin'}
        kpis={{
          totalPedidos: stats.totalPedidos,
          valorTotal: stats.valorTotalComprado,
          valorFaturado: stats.valorFaturado,
          qtdFaturada: stats.qtdFaturada,
          pendenteFaturamento: stats.valorTotalComprado - stats.valorFaturado,
          qtdPendenteFaturamento: stats.totalPedidos - stats.qtdFaturada,
          valorAVencer: stats.valorAVencer,
          valorVencido: stats.valorVencido,
        }}
      />

      {/* Cards extras para fornecedor: Produtos Ativos e Estoque Baixo */}
      {(isFornecedor || isAdmin) && (
        <div className="grid grid-cols-2 gap-4 md:gap-6">
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <BarChart3 className="w-10 h-10 text-purple-600 opacity-80" />
                <Badge className="bg-purple-100 text-purple-800 text-xs">Produtos</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Produtos Ativos</p>
                <p className="text-3xl font-bold text-gray-900">{stats.produtosAtivos}</p>
              </div>
            </CardContent>
          </Card>
          {stats.estoqueBaixo > 0 && (
            <Card className="bg-slate-100 rounded-2xl shadow-neumorphic hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <AlertTriangle className="w-10 h-10 text-orange-600 opacity-80" />
                  <Badge className="bg-orange-100 text-orange-800 text-xs">Alerta</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Estoque Baixo</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.estoqueBaixo}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Ações Rápidas */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader>
          <CardTitle className="text-xl">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {isCliente && (
              <>
                <Link to={createPageUrl('Catalogo')}>
                  <Button className="w-full h-24 flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 rounded-xl">
                    <ShoppingCart className="w-6 h-6" />
                    <span className="text-sm">Ver Catálogo</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('MeusPedidos')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <Package className="w-6 h-6" />
                    <span className="text-sm">Meus Pedidos</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('Carrinho')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <ShoppingCart className="w-6 h-6" />
                    <span className="text-sm">Carrinho</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('Recursos')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <FileText className="w-6 h-6" />
                    <span className="text-sm">Recursos</span>
                  </Button>
                </Link>
              </>
            )}

            {isFornecedor && (
              <>
                <Link to={createPageUrl('GestaoProdutos')}>
                  <Button className="w-full h-24 flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 rounded-xl">
                    <Package className="w-6 h-6" />
                    <span className="text-sm">Produtos</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('PedidosFornecedor')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <FileText className="w-6 h-6" />
                    <span className="text-sm">Pedidos</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('GestaoEstoque')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <BarChart3 className="w-6 h-6" />
                    <span className="text-sm">Estoque</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('GestaoCapsulas')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <Eye className="w-6 h-6" />
                    <span className="text-sm">Cápsulas</span>
                  </Button>
                </Link>
              </>
            )}

            {isAdmin && (
              <>
                <Link to={createPageUrl('PedidosAdmin')}>
                  <Button className="w-full h-24 flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 rounded-xl">
                    <Package className="w-6 h-6" />
                    <span className="text-sm">Pedidos</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('GestaoProdutos')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <ShoppingCart className="w-6 h-6" />
                    <span className="text-sm">Produtos</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('CrmDashboard')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                    <span className="text-sm">CRM</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('UserManagement')}>
                  <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-xl">
                    <FileText className="w-6 h-6" />
                    <span className="text-sm">Usuários</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pedidos Recentes */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Pedidos Recentes</CardTitle>
          <Link to={createPageUrl(isCliente ? 'MeusPedidos' : isFornecedor ? 'PedidosFornecedor' : 'PedidosAdmin')}>
            <Button variant="ghost" size="sm">Ver todos</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map(pedido => {
                const statusInfo = getStatusInfo(pedido.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div key={pedido.id} className="flex items-center justify-between p-4 bg-white rounded-xl shadow-neumorphic-inset">
                    <div className="flex items-center gap-4">
                      <StatusIcon className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-semibold">#{pedido.id.slice(-8).toUpperCase()}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(pedido.created_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(pedido.valor_total)}</p>
                      <Badge className={`${statusInfo.color} text-xs mt-1`}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
