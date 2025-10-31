import React, { useState, useEffect } from 'react';
import { WhatsappTemplate } from '@/api/entities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageCircle, Send, User, Copy, Check, AlertTriangle, FileText
} from 'lucide-react';

export default function WhatsappModal({ contacts, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const templatesList = await WhatsappTemplate.list();
      setTemplates(templatesList.filter(t => t.ativo));
    } catch (error) {
    }
  };

  const aplicarTemplate = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      let mensagemPersonalizada = template.mensagem;
      
      // Substituir variáveis pelo primeiro contato
      if (contacts.length > 0) {
        const contact = contacts[0];
        mensagemPersonalizada = mensagemPersonalizada
          .replace(/\{nome\}/g, contact.nome)
          .replace(/\{empresa\}/g, contact.empresa)
          .replace(/\{cidade\}/g, contact.cidade)
          .replace(/\{estado\}/g, contact.estado);
      }
      
      setMensagem(mensagemPersonalizada);
    }
  };

  const copiarMensagem = () => {
    navigator.clipboard.writeText(mensagem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enviarParaWhatsApp = (contact) => {
    const phone = contact.telefone.replace(/\D/g, '');
    let mensagemPersonalizada = mensagem
      .replace(/\{nome\}/g, contact.nome)
      .replace(/\{empresa\}/g, contact.empresa)
      .replace(/\{cidade\}/g, contact.cidade)
      .replace(/\{estado\}/g, contact.estado);
    
    const encodedMessage = encodeURIComponent(mensagemPersonalizada);
    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-600" />
            Enviar Mensagem via WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contatos Selecionados */}
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm font-semibold mb-2 block">
                Contatos Selecionados ({contacts.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {contacts.map(contact => (
                  <Badge key={contact.id} variant="outline" className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {contact.nome}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Templates */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates de Mensagem
            </Label>
            <Select onValueChange={aplicarTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template ou escreva sua mensagem" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedTemplate && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-sm text-blue-800">
                  <strong>{selectedTemplate.titulo}</strong>
                  <p className="mt-1 text-xs">
                    Variáveis disponíveis: {'{nome}'}, {'{empresa}'}, {'{cidade}'}, {'{estado}'}
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Mensagem */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Mensagem</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite sua mensagem aqui..."
              rows={10}
              className="resize-none"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {mensagem.length} caracteres
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={copiarMensagem}
                disabled={!mensagem}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar Mensagem
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Lista de Contatos com Botões */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Enviar para:</Label>
              {contacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{contact.nome}</p>
                    <p className="text-sm text-gray-600">{contact.telefone}</p>
                  </div>
                  <Button
                    onClick={() => enviarParaWhatsApp(contact)}
                    disabled={!mensagem}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {contacts.length > 1 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-orange-800">
                Para enviar para múltiplos contatos, você precisará abrir o WhatsApp de cada um individualmente.
                Use variáveis nos templates para personalizar automaticamente as mensagens.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}