import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, FileText, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/exportUtils';

const CARD_CONFIG = [
  {
    key: 'totalPedidos',
    icon: Package,
    iconColor: 'text-blue-600',
    badgeClass: 'bg-blue-100 text-blue-800',
    badgeLabel: 'Total',
    labelCliente: 'Total de Compras',
    labelOutros: 'Total de Pedidos',
    format: 'number',
  },
  {
    key: 'valorTotal',
    icon: DollarSign,
    iconColor: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-800',
    badgeLabel: 'Vendas',
    labelCliente: 'Valor Total Comprado',
    labelOutros: 'Valor Total Vendido',
    format: 'currency',
  },
  {
    key: 'valorFaturado',
    subKey: 'qtdFaturada',
    icon: FileText,
    iconColor: 'text-indigo-600',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    badgeLabel: 'Faturado',
    labelCliente: 'Valor Faturado',
    labelOutros: 'Valor Faturado',
    format: 'currency',
    subFormat: 'pedidos',
  },
  {
    key: 'pendenteFaturamento',
    subKey: 'qtdPendenteFaturamento',
    icon: TrendingUp,
    iconColor: 'text-purple-600',
    badgeClass: 'bg-purple-100 text-purple-800',
    badgeLabel: 'Pendente',
    labelCliente: 'Pendente de Faturamento',
    labelOutros: 'Pendente de Faturamento',
    format: 'currency',
    subFormat: 'pedidos',
  },
  {
    key: 'valorAVencer',
    icon: Calendar,
    iconColor: 'text-yellow-600',
    badgeClass: 'bg-yellow-100 text-yellow-800',
    badgeLabel: 'A Vencer',
    labelCliente: 'Valores a Vencer',
    labelOutros: 'Valores a Vencer',
    format: 'currency',
  },
  {
    key: 'valorVencido',
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-800',
    badgeLabel: 'Vencido',
    labelCliente: 'Valores Vencidos',
    labelOutros: 'Valores Vencidos',
    format: 'currency',
  },
];

function formatValue(value, format) {
  if (format === 'currency') return formatCurrency(value || 0);
  return value || 0;
}

export default function DashboardKpiCards({ role, kpis }) {
  const isCliente = role === 'cliente';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {CARD_CONFIG.map((card) => {
        const Icon = card.icon;
        const label = isCliente ? card.labelCliente : card.labelOutros;
        const value = kpis[card.key] ?? 0;
        const subValue = card.subKey ? kpis[card.subKey] : null;

        return (
          <Card key={card.key} className="bg-slate-100 rounded-2xl shadow-neumorphic hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Icon className={`w-10 h-10 ${card.iconColor} opacity-80`} />
                <Badge className={`${card.badgeClass} text-xs`}>{card.badgeLabel}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{label}</p>
                <p className={`${card.format === 'currency' ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
                  {formatValue(value, card.format)}
                </p>
                {subValue != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {subValue} {card.subFormat === 'pedidos' ? (subValue === 1 ? 'pedido' : 'pedidos') : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
