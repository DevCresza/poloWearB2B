import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, Edit, Package, DollarSign, Calendar, User, 
  Building, Clock, CheckCircle, Truck, X, FileText
} from 'lucide-react';

export default function PedidoCard({ 
  pedido, 
  userMap, 
  fornecedorMap, 
  onViewDetails, 
  onEdit, 
  onStatusChange, 
  onPaymentStatusChange,
  getStatusInfo,
  getPaymentStatusInfo,
  updatingPedidoId 
}) {
  const statusInfo = getStatusInfo(pedido.status);
  const paymentStatusInfo = getPaymentStatusInfo(pedido.status_pagamento);
  const StatusIcon = statusInfo.icon;
  const PaymentIcon = paymentStatusInfo.icon;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon className="w-4 h-4" />
              <span className="font-mono text-sm font-semibold">
                #{pedido.id.slice(-8).toUpperCase()}
              </span>
            </div>
            <Badge className={statusInfo.color}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-600">
              R$ {pedido.valor_total?.toFixed(2)}
            </div>
            <Badge className={`${paymentStatusInfo.color} mt-1`} variant="outline">
              <PaymentIcon className="w-3 h-3 mr-1" />
              {paymentStatusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Informações */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{userMap.get(pedido.comprador_user_id) || 'Cliente'}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Building className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{fornecedorMap.get(pedido.fornecedor_id) || 'Fornecedor'}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{new Date(pedido.created_date).toLocaleDateString('pt-BR')}</span>
          </div>

          {pedido.data_prevista_entrega && (
            <div className="flex items-center gap-2 text-gray-600">
              <Truck className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs">
                Entrega: {new Date(pedido.data_prevista_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {/* Documentos */}
        {(pedido.nf_url || pedido.boleto_url || pedido.codigo_rastreio) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {pedido.nf_url && (
              <Badge variant="outline" className="text-xs">
                <FileText className="w-3 h-3 mr-1" />
                NF Disponível
              </Badge>
            )}
            {pedido.boleto_url && (
              <Badge variant="outline" className="text-xs">
                <DollarSign className="w-3 h-3 mr-1" />
                Boleto Disponível
              </Badge>
            )}
            {pedido.codigo_rastreio && (
              <Badge variant="outline" className="text-xs">
                <Package className="w-3 h-3 mr-1" />
                {pedido.codigo_rastreio}
              </Badge>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(pedido)}
            >
              <Eye className="w-4 h-4 mr-1" />
              Ver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(pedido)}
            >
              <Edit className="w-4 h-4 mr-1" />
              Editar
            </Button>
          </div>

          {/* Mudança de Status */}
          <Select
            value={pedido.status}
            onValueChange={(newStatus) => onStatusChange(pedido.id, newStatus)}
            disabled={updatingPedidoId === pedido.id}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="novo_pedido">Novo Pedido</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="faturado">Faturado</SelectItem>
              <SelectItem value="em_transporte">Em Transporte</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {/* Mudança de Status Pagamento */}
          <Select
            value={pedido.status_pagamento}
            onValueChange={(newStatus) => onPaymentStatusChange(pedido.id, newStatus)}
            disabled={updatingPedidoId === pedido.id}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pagamento Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}