import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Archive,
  FileText,
  DollarSign,
  Store,
  X,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Modal de detalhes de lead arquivado
 * Exibe todas as informações do lead incluindo dados de arquivamento
 */
export default function ArchivedLeadDetailsModal({ open, onClose, lead }) {
  if (!lead) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      convertido: { label: 'Convertido', color: 'bg-green-100 text-green-800' },
      cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const InfoRow = ({ icon: Icon, label, value, className = "" }) => (
    <div className={`flex items-center gap-3 ${className}`}>
      <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-700">{label}:</span>
        <span className="ml-2 text-sm text-gray-900">{value || 'N/A'}</span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-600" />
            Detalhes do Lead Arquivado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Informações Pessoais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={User} label="Nome" value={lead.nome} />
              <InfoRow icon={Mail} label="Email" value={lead.email} />
              <InfoRow icon={Phone} label="Telefone" value={lead.telefone} />
              <InfoRow icon={Building} label="Empresa" value={lead.empresa} />
              <InfoRow icon={MapPin} label="Cidade" value={lead.cidade} />
              <InfoRow icon={MapPin} label="Estado" value={lead.estado} />
            </div>
          </div>

          <Separator />

          {/* Informações do Negócio */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Informações do Negócio
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                icon={DollarSign}
                label="Faixa de Faturamento"
                value={lead.faixa_faturamento}
              />
              <InfoRow
                icon={Store}
                label="Tem Loja Física"
                value={lead.tem_loja_fisica ? 'Sim' : 'Não'}
              />
              <InfoRow
                icon={FileText}
                label="Fonte do Lead"
                value={lead.fonte_lead}
              />
              <div className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">Status Final:</span>
                  <div className="ml-2 inline-block">
                    {getStatusBadge(lead.status_final)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Informações de Arquivamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
              Informações do Arquivamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow
                icon={Calendar}
                label="Data do Arquivamento"
                value={formatDate(lead.data_arquivamento)}
              />
              <InfoRow
                icon={User}
                label="Arquivado Por"
                value={lead.arquivado_por}
              />
              <InfoRow
                icon={Calendar}
                label="Data de Criação Original"
                value={formatDate(lead.data_criacao_original)}
              />
            </div>

            {lead.motivo_arquivamento && (
              <div className="mt-4">
                <InfoRow
                  icon={FileText}
                  label="Motivo do Arquivamento"
                  value={lead.motivo_arquivamento}
                  className="items-start"
                />
              </div>
            )}
          </div>

          {/* Observações */}
          {lead.observacoes && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                  Observações
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {lead.observacoes}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
