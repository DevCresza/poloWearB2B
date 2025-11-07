import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SendEmail } from '@/api/integrations';
import { CheckCircle, Send, User, Mail, Phone, Building, MapPin, AlertCircle, Store, DollarSign } from 'lucide-react';
import { Contact } from '@/api/entities';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    empresa: '',
    cidade: '',
    estado: '',
    tem_loja_fisica: '',
    faixa_faturamento: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const faixasFaturamento = [
    '0-10k',
    '10k-20k',
    '20k-30k',
    '30k-40k',
    'Acima de 50k'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Validações obrigatórias
      if (!formData.nome) {
        toast.error('Por favor, preencha seu nome.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.email) {
        toast.error('Por favor, preencha seu email.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.telefone) {
        toast.error('Por favor, preencha seu telefone.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.estado) {
        toast.error('Por favor, selecione seu estado.');
        setIsSubmitting(false);
        return;
      }

      if (!formData.cidade) {
        toast.error('Por favor, preencha sua cidade.');
        setIsSubmitting(false);
        return;
      }

      // Salvar no CRM (Contact)
      const novoContato = await Contact.create({
        ...formData,
        status: 'novo',
        fonte_lead: 'Formulário Site - Interesse',
        ultimo_contato: new Date().toISOString(),
        observacoes: `Lead gerado via formulário "Vamos Conversar" da home page.
Tem loja física: ${formData.tem_loja_fisica}
Faixa de faturamento: ${formData.faixa_faturamento}`
      });


      // Enviar email de notificação para Roberto
      try {
        await SendEmail({
          to: 'roberto@polomultimarca.com.br',
          subject: 'Nova Solicitação de Interesse - POLO Wear Multimarca',
          body: `Nova solicitação de contato para multimarca POLO Wear:

DADOS DO INTERESSADO:
Nome: ${formData.nome}
Email: ${formData.email}
Telefone: ${formData.telefone}
Empresa: ${formData.empresa}
Cidade: ${formData.cidade}
Estado: ${formData.estado}
Tem Loja Física: ${formData.tem_loja_fisica}
Faixa de Faturamento: ${formData.faixa_faturamento}

ORIGEM: Formulário "Vamos Conversar" - Home Page

--
Este lead foi automaticamente salvo no CRM para acompanhamento.
Data: ${new Date().toLocaleString('pt-BR')}`
        });
      } catch (emailError) {
        // Não falha o processo se o email não enviar
        console.error('Erro ao enviar email de notificação:', emailError);
        toast.warning('Contato salvo com sucesso, mas o email de notificação não foi enviado.');
      }
      
      setShowSuccessDialog(true);
      
      // Limpar formulário
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        empresa: '',
        cidade: '',
        estado: '',
        tem_loja_fisica: '',
        faixa_faturamento: ''
      });
      
    } catch (error) {
      setErrorMessage(error.message || 'Ocorreu um erro ao salvar os dados.');
      setShowErrorDialog(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section id="contato" className="py-20 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Vamos Conversar?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Preencha o formulário e nossa equipe entrará em contato para apresentar 
              as melhores condições para sua loja.
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-2xl border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
                <CardTitle className="text-2xl font-bold text-center">
                  Formulário de Interesse
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="nome" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Nome Completo *
                      </Label>
                      <Input
                        id="nome"
                        type="text"
                        required
                        value={formData.nome}
                        onChange={(e) => setFormData({...formData, nome: e.target.value})}
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="h-12"
                      />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="telefone" className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Telefone *
                      </Label>
                      <Input
                        id="telefone"
                        type="tel"
                        required
                        value={formData.telefone}
                        onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="empresa" className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Nome da Empresa *
                      </Label>
                      <Input
                        id="empresa"
                        type="text"
                        required
                        value={formData.empresa}
                        onChange={(e) => setFormData({...formData, empresa: e.target.value})}
                        className="h-12"
                      />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="cidade" className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Cidade *
                      </Label>
                      <Input
                        id="cidade"
                        type="text"
                        required
                        value={formData.cidade}
                        onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                        className="h-12"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado *</Label>
                      <Select 
                        value={formData.estado} 
                        onValueChange={(value) => setFormData({...formData, estado: value})}
                        required
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione o estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {estados.map(estado => (
                            <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="tem_loja_fisica" className="flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        Tem Loja Física? *
                      </Label>
                      <Select 
                        value={formData.tem_loja_fisica} 
                        onValueChange={(value) => setFormData({...formData, tem_loja_fisica: value})}
                        required
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="faixa_faturamento" className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Faixa de Faturamento *
                      </Label>
                      <Select 
                        value={formData.faixa_faturamento} 
                        onValueChange={(value) => setFormData({...formData, faixa_faturamento: value})}
                        required
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Selecione a faixa" />
                        </SelectTrigger>
                        <SelectContent>
                          {faixasFaturamento.map(faixa => (
                            <SelectItem key={faixa} value={faixa}>{faixa}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-semibold rounded-xl"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Enviar Solicitação
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Mensagem Enviada!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 leading-relaxed">
              Obrigado pelo seu interesse! Sua solicitação foi enviada com sucesso e nossa equipe entrará em contato em breve.
            </p>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={() => setShowSuccessDialog(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6" />
              Erro no Envio
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600 leading-relaxed mb-4">
              Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.
            </p>
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">Detalhes: {errorMessage}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              onClick={() => setShowErrorDialog(false)}
              variant="outline"
            >
              Tentar Novamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}