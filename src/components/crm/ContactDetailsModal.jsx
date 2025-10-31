import React, { useState } from 'react';
import { Contact } from '@/api/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User, Mail, Phone, Building, MapPin, Calendar, 
  FileText, Save, X, MessageCircle, Store, DollarSign
} from 'lucide-react';

export default function ContactDetailsModal({ contact, onClose, onUpdate }) {
  const [observacoes, setObservacoes] = useState(contact.observacoes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Contact.update(contact.id, { 
        observacoes,
        ultimo_contato: new Date().toISOString()
      });
      alert('Observações salvas com sucesso!');
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar observações.');
    } finally {
      setSaving(false);
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const openWhatsApp = () => {
    const phone = contact.telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${contact.nome}, tudo bem? Sou da POLO Wear e estou entrando em contato sobre sua solicitação de interesse em nossa rede multimarca.`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <User className="w-6 h-6" />
            Detalhes do Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações Principais */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase">Nome Completo</Label>
                  <p className="text-lg font-semibold">{contact.nome}</p>
                </div>
                
                <div>
                  <Label className="text-xs text-gray-500 uppercase">Empresa</Label>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    {contact.empresa}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </Label>
                  <p className="text-sm">{contact.email}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Telefone
                  </Label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{formatPhone(contact.telefone)}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openWhatsApp}
                      className="h-7"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Localização
                  </Label>
                  <p className="text-sm">{contact.cidade} - {contact.estado}</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <Store className="w-3 h-3" />
                    Loja Física
                  </Label>
                  <Badge variant={contact.tem_loja_fisica === 'sim' ? 'default' : 'secondary'}>
                    {contact.tem_loja_fisica === 'sim' ? 'Sim' : 'Não'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Faturamento
                  </Label>
                  <Badge variant="outline">{contact.faixa_faturamento}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informações de Acompanhamento */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Data de Criação
                  </Label>
                  <p className="text-sm">{new Date(contact.created_date).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>

                <div>
                  <Label className="text-xs text-gray-500 uppercase">Fonte do Lead</Label>
                  <Badge>{contact.fonte_lead}</Badge>
                </div>
              </div>

              {contact.ultimo_contato && (
                <div>
                  <Label className="text-xs text-gray-500 uppercase">Último Contato</Label>
                  <p className="text-sm">{new Date(contact.ultimo_contato).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Observações e Anotações
              </Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Adicione observações sobre este lead, histórico de contatos, interesse demonstrado, etc."
                rows={6}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Observações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}