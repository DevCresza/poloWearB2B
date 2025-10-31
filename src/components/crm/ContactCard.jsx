import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, MessageCircle, Phone, Mail, MapPin, Building, 
  Calendar, UserPlus, TrendingUp
} from 'lucide-react';

export default function ContactCard({ 
  contact, 
  onViewDetails, 
  onSendWhatsapp, 
  onStatusChange, 
  onCreateUser,
  getStatusColor,
  getStatusIcon 
}) {
  const StatusIcon = getStatusIcon(contact.status);
  
  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Header com Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full ${getStatusColor(contact.status)} bg-opacity-20 flex items-center justify-center`}>
              <StatusIcon className={`w-5 h-5 text-${getStatusColor(contact.status).split('-')[1]}-600`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{contact.nome}</h3>
              <p className="text-xs text-gray-500">
                {new Date(contact.created_date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* Informações de Contato */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Building className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{contact.empresa}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <Mail className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <span>{formatPhone(contact.telefone)}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span>{contact.cidade} - {contact.estado}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {contact.fonte_lead && (
            <Badge variant="outline" className="text-xs">
              {contact.fonte_lead}
            </Badge>
          )}
          {contact.tem_loja_fisica === 'sim' && (
            <Badge variant="outline" className="text-xs bg-blue-50">
              Loja Física
            </Badge>
          )}
          {contact.faixa_faturamento && (
            <Badge variant="outline" className="text-xs bg-green-50">
              {contact.faixa_faturamento}
            </Badge>
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(contact)}
              className="w-full"
            >
              <Eye className="w-4 h-4 mr-1" />
              Detalhes
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendWhatsapp(contact)}
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-1" />
              WhatsApp
            </Button>
          </div>

          {/* Mudança de Status */}
          <Select
            value={contact.status}
            onValueChange={(newStatus) => onStatusChange(contact.id, newStatus)}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="novo">Novo Lead</SelectItem>
              <SelectItem value="em_contato">Em Contato</SelectItem>
              <SelectItem value="negociacao">Em Negociação</SelectItem>
              <SelectItem value="convertido">Convertido</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão de Conversão */}
          {contact.status === 'negociacao' && (
            <Button
              onClick={() => onCreateUser(contact)}
              className="w-full bg-green-600 hover:bg-green-700 h-8 text-xs"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Converter em Cliente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}