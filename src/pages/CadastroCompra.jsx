import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Contact } from '@/api/entities';
import { SendEmail } from '@/api/integrations';
import { Store, ArrowRight, CheckCircle, Phone, Mail, Building, MapPin, User, CreditCard, Truck } from 'lucide-react';

export default function CadastroCompra() {
  // Detectar se é formulário de registro (view=register)
  const urlParams = new URLSearchParams(window.location.search);
  const isRegisterView = urlParams.get('view') === 'register';

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    // Dados da Loja
    nome_loja: '',
    cnpj: '',
    inscricao_estadual: '',
    
    // Dados do Responsável
    nome_responsavel: '',
    cpf_responsavel: '',
    email_responsavel: '',
    telefone_responsavel: '',
    whatsapp_responsavel: '',
    
    // Endereço da Loja
    endereco_rua: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    endereco_cep: '',
    
    // Dados de Entrega (se diferente)
    entrega_mesmo_endereco: 'sim',
    entrega_rua: '',
    entrega_numero: '',
    entrega_complemento: '',
    entrega_bairro: '',
    entrega_cidade: '',
    entrega_estado: '',
    entrega_cep: '',
    
    // Contatos Adicionais
    contato_financeiro_nome: '',
    contato_financeiro_email: '',
    contato_financeiro_telefone: '',
    
    contato_comercial_nome: '',
    contato_comercial_email: '',
    contato_comercial_telefone: '',
    
    // Informações Comerciais
    tempo_atuacao: '',
    numero_funcionarios: '',
    observacoes: ''
  });

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  // Buscar endereço pelo CEP da loja
  const buscarCEPLoja = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco_rua: data.logradouro || prev.endereco_rua,
          endereco_bairro: data.bairro || prev.endereco_bairro,
          endereco_cidade: data.localidade || prev.endereco_cidade,
          endereco_estado: data.uf || prev.endereco_estado
        }));
      } else {
        alert('CEP não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      alert('Erro ao buscar CEP. Verifique sua conexão.');
    }
  };

  // Buscar endereço pelo CEP de entrega
  const buscarCEPEntrega = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          entrega_rua: data.logradouro || prev.entrega_rua,
          entrega_bairro: data.bairro || prev.entrega_bairro,
          entrega_cidade: data.localidade || prev.entrega_cidade,
          entrega_estado: data.uf || prev.entrega_estado
        }));
      } else {
        alert('CEP não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      alert('Erro ao buscar CEP. Verifique sua conexão.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.nome_loja || !formData.cnpj || !formData.nome_responsavel || 
        !formData.email_responsavel || !formData.telefone_responsavel) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Montar endereço completo
      const enderecoCompleto = `${formData.endereco_rua}, ${formData.endereco_numero}${formData.endereco_complemento ? ' - ' + formData.endereco_complemento : ''}, ${formData.endereco_bairro}, ${formData.endereco_cidade}/${formData.endereco_estado}`;
      
      let enderecoEntregaCompleto = enderecoCompleto;
      if (formData.entrega_mesmo_endereco === 'nao') {
        enderecoEntregaCompleto = `${formData.entrega_rua}, ${formData.entrega_numero}${formData.entrega_complemento ? ' - ' + formData.entrega_complemento : ''}, ${formData.entrega_bairro}, ${formData.entrega_cidade}/${formData.entrega_estado}`;
      }

      // Dados para salvar no CRM
      const dadosContato = {
        nome: formData.nome_responsavel,
        email: formData.email_responsavel,
        telefone: formData.telefone_responsavel,
        empresa: formData.nome_loja,
        cidade: formData.endereco_cidade,
        estado: formData.endereco_estado,
        status: 'novo',
        fonte_lead: isRegisterView ? 'Formulário Site - Cadastro Lojista' : 'Formulário Site - Cadastro Franqueado',
        observacoes: `Lead gerado via formulário "${isRegisterView ? 'Cadastro de Lojista' : 'Sou Franqueado Polo Wear'}".

DADOS DA LOJA:
Nome: ${formData.nome_loja}
CNPJ: ${formData.cnpj}
Inscrição Estadual: ${formData.inscricao_estadual || 'Não informado'}

RESPONSÁVEL:
Nome: ${formData.nome_responsavel}
CPF: ${formData.cpf_responsavel || 'Não informado'}
Email: ${formData.email_responsavel}
Telefone: ${formData.telefone_responsavel}
WhatsApp: ${formData.whatsapp_responsavel || formData.telefone_responsavel}

ENDEREÇO DA LOJA:
${enderecoCompleto}
CEP: ${formData.endereco_cep}

ENDEREÇO DE ENTREGA:
${formData.entrega_mesmo_endereco === 'sim' ? 'Mesmo da loja' : enderecoEntregaCompleto}
${formData.entrega_mesmo_endereco === 'nao' ? 'CEP: ' + formData.entrega_cep : ''}

CONTATO FINANCEIRO:
Nome: ${formData.contato_financeiro_nome || 'Não informado'}
Email: ${formData.contato_financeiro_email || 'Não informado'}
Telefone: ${formData.contato_financeiro_telefone || 'Não informado'}

CONTATO COMERCIAL:
Nome: ${formData.contato_comercial_nome || 'Não informado'}
Email: ${formData.contato_comercial_email || 'Não informado'}
Telefone: ${formData.contato_comercial_telefone || 'Não informado'}

INFORMAÇÕES COMERCIAIS:
Tempo de Atuação: ${formData.tempo_atuacao || 'Não informado'}
Número de Funcionários: ${formData.numero_funcionarios || 'Não informado'}

OBSERVAÇÕES:
${formData.observacoes || 'Nenhuma observação'}

Data do Cadastro: ${new Date().toLocaleString('pt-BR')}`
      };

      // Salvar no banco
      await Contact.create(dadosContato);

      // Enviar email
      try {
        await SendEmail({
          to: 'roberto@polomultimarca.com.br',
          subject: isRegisterView ? 'Novo Lead - Cadastro de Lojista POLO Wear' : 'Nova Solicitação - Cadastro Franqueado POLO Wear',
          body: `${isRegisterView ? 'Novo lead de lojista interessado em revender POLO Wear' : 'Nova solicitação de cadastro de franqueado POLO Wear'}:

DADOS DA LOJA:
Nome da Loja: ${formData.nome_loja}
CNPJ: ${formData.cnpj}
Inscrição Estadual: ${formData.inscricao_estadual || 'Não informado'}

RESPONSÁVEL:
Nome: ${formData.nome_responsavel}
CPF: ${formData.cpf_responsavel || 'Não informado'}
Email: ${formData.email_responsavel}
Telefone: ${formData.telefone_responsavel}
WhatsApp: ${formData.whatsapp_responsavel || formData.telefone_responsavel}

ENDEREÇO:
${enderecoCompleto}
CEP: ${formData.endereco_cep}

ENTREGA:
${formData.entrega_mesmo_endereco === 'sim' ? 'Mesmo endereço da loja' : enderecoEntregaCompleto}

CONTATO FINANCEIRO:
Nome: ${formData.contato_financeiro_nome || 'Não informado'}
Email: ${formData.contato_financeiro_email || 'Não informado'}
Telefone: ${formData.contato_financeiro_telefone || 'Não informado'}

CONTATO COMERCIAL:
Nome: ${formData.contato_comercial_nome || 'Não informado'}
Email: ${formData.contato_comercial_email || 'Não informado'}
Telefone: ${formData.contato_comercial_telefone || 'Não informado'}

INFORMAÇÕES COMERCIAIS:
Tempo de Atuação: ${formData.tempo_atuacao || 'Não informado'}
Funcionários: ${formData.numero_funcionarios || 'Não informado'}

Observações: ${formData.observacoes || 'Nenhuma'}

Origem: Formulário Site
Data: ${new Date().toLocaleString('pt-BR')}`
        });
      } catch (emailError) {
        console.error('Erro no email:', emailError);
      }
      
      setSuccess(true);
      
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {isRegisterView ? 'Cadastro Recebido!' : 'Solicitação Enviada!'}
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              {isRegisterView
                ? 'Obrigado pelo interesse em revender POLO Wear! Nossa equipe comercial entrará em contato em até 24 horas.'
                : 'Obrigado pelo interesse em ser franqueado POLO Wear. Nossa equipe entrará em contato em até 24 horas.'}
            </p>
            <Button 
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              Voltar ao Site
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <Card className="shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <Store className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl font-bold">
                  {isRegisterView ? 'Cadastro de Lojista Polo Wear' : 'Sou Franqueado Polo Wear'}
                </CardTitle>
                <p className="text-blue-100">
                  {isRegisterView ? 'Preencha seus dados para começar a revender' : 'Preencha seus dados completos para cadastro'}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Dados da Loja */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">
                    {isRegisterView ? 'Dados da Loja' : 'Dados da Loja Franqueada'}
                  </h3>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nome_loja">
                      {isRegisterView ? 'Nome da Loja *' : 'Nome da Loja Franqueada *'}
                    </Label>
                    <Input
                      id="nome_loja"
                      value={formData.nome_loja}
                      onChange={(e) => setFormData({...formData, nome_loja: e.target.value})}
                      required
                      placeholder="Ex: Polo Wear Shopping Center"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                      required
                      placeholder="00.000.000/0000-00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                    <Input
                      id="inscricao_estadual"
                      value={formData.inscricao_estadual}
                      onChange={(e) => setFormData({...formData, inscricao_estadual: e.target.value})}
                      placeholder="000.000.000.000"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dados do Responsável */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Dados do Responsável</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nome_responsavel">Nome Completo *</Label>
                    <Input
                      id="nome_responsavel"
                      value={formData.nome_responsavel}
                      onChange={(e) => setFormData({...formData, nome_responsavel: e.target.value})}
                      required
                      placeholder="Nome completo do responsável"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpf_responsavel">CPF</Label>
                    <Input
                      id="cpf_responsavel"
                      value={formData.cpf_responsavel}
                      onChange={(e) => setFormData({...formData, cpf_responsavel: e.target.value})}
                      placeholder="000.000.000-00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_responsavel">Email *</Label>
                    <Input
                      id="email_responsavel"
                      type="email"
                      value={formData.email_responsavel}
                      onChange={(e) => setFormData({...formData, email_responsavel: e.target.value})}
                      required
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone_responsavel">Telefone *</Label>
                    <Input
                      id="telefone_responsavel"
                      value={formData.telefone_responsavel}
                      onChange={(e) => setFormData({...formData, telefone_responsavel: e.target.value})}
                      required
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_responsavel">WhatsApp</Label>
                    <Input
                      id="whatsapp_responsavel"
                      value={formData.whatsapp_responsavel}
                      onChange={(e) => setFormData({...formData, whatsapp_responsavel: e.target.value})}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço da Loja */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Endereço da Loja</h3>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* CEP primeiro para buscar automaticamente */}
                  <div className="space-y-2">
                    <Label htmlFor="endereco_cep">CEP *</Label>
                    <Input
                      id="endereco_cep"
                      value={formData.endereco_cep}
                      onChange={(e) => setFormData({...formData, endereco_cep: e.target.value})}
                      onBlur={(e) => buscarCEPLoja(e.target.value)}
                      required
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <p className="text-xs text-gray-500">Preencha o CEP para buscar o endereço</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="endereco_rua">Rua/Avenida *</Label>
                    <Input
                      id="endereco_rua"
                      value={formData.endereco_rua}
                      onChange={(e) => setFormData({...formData, endereco_rua: e.target.value})}
                      required
                      placeholder="Nome da rua"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco_numero">Número *</Label>
                    <Input
                      id="endereco_numero"
                      value={formData.endereco_numero}
                      onChange={(e) => setFormData({...formData, endereco_numero: e.target.value})}
                      required
                      placeholder="123"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco_complemento">Complemento</Label>
                    <Input
                      id="endereco_complemento"
                      value={formData.endereco_complemento}
                      onChange={(e) => setFormData({...formData, endereco_complemento: e.target.value})}
                      placeholder="Sala, Loja, etc"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco_bairro">Bairro *</Label>
                    <Input
                      id="endereco_bairro"
                      value={formData.endereco_bairro}
                      onChange={(e) => setFormData({...formData, endereco_bairro: e.target.value})}
                      required
                      placeholder="Nome do bairro"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco_cidade">Cidade *</Label>
                    <Input
                      id="endereco_cidade"
                      value={formData.endereco_cidade}
                      onChange={(e) => setFormData({...formData, endereco_cidade: e.target.value})}
                      required
                      placeholder="Nome da cidade"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endereco_estado">Estado *</Label>
                    <Select 
                      value={formData.endereco_estado} 
                      onValueChange={(value) => setFormData({...formData, endereco_estado: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {estados.map(estado => (
                          <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="entrega_mesmo_endereco">Endereço de Entrega</Label>
                    <Select 
                      value={formData.entrega_mesmo_endereco} 
                      onValueChange={(value) => setFormData({...formData, entrega_mesmo_endereco: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Mesmo endereço da loja</SelectItem>
                        <SelectItem value="nao">Endereço diferente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Endereço de Entrega Diferente */}
                {formData.entrega_mesmo_endereco === 'nao' && (
                  <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2 md:col-span-3">
                      <Truck className="w-5 h-5 text-blue-600" />
                      <h4 className="text-lg font-semibold text-gray-900">Endereço de Entrega</h4>
                    </div>

                    {/* CEP primeiro para buscar automaticamente */}
                    <div className="space-y-2">
                      <Label htmlFor="entrega_cep">CEP *</Label>
                      <Input
                        id="entrega_cep"
                        value={formData.entrega_cep}
                        onChange={(e) => setFormData({...formData, entrega_cep: e.target.value})}
                        onBlur={(e) => buscarCEPEntrega(e.target.value)}
                        required
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      <p className="text-xs text-gray-500">Preencha o CEP para buscar o endereço</p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="entrega_rua">Rua/Avenida *</Label>
                      <Input
                        id="entrega_rua"
                        value={formData.entrega_rua}
                        onChange={(e) => setFormData({...formData, entrega_rua: e.target.value})}
                        required
                        placeholder="Nome da rua"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entrega_numero">Número *</Label>
                      <Input
                        id="entrega_numero"
                        value={formData.entrega_numero}
                        onChange={(e) => setFormData({...formData, entrega_numero: e.target.value})}
                        required
                        placeholder="123"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entrega_complemento">Complemento</Label>
                      <Input
                        id="entrega_complemento"
                        value={formData.entrega_complemento}
                        onChange={(e) => setFormData({...formData, entrega_complemento: e.target.value})}
                        placeholder="Sala, Loja, etc"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entrega_bairro">Bairro *</Label>
                      <Input
                        id="entrega_bairro"
                        value={formData.entrega_bairro}
                        onChange={(e) => setFormData({...formData, entrega_bairro: e.target.value})}
                        required
                        placeholder="Nome do bairro"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entrega_cidade">Cidade *</Label>
                      <Input
                        id="entrega_cidade"
                        value={formData.entrega_cidade}
                        onChange={(e) => setFormData({...formData, entrega_cidade: e.target.value})}
                        required
                        placeholder="Nome da cidade"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="entrega_estado">Estado *</Label>
                      <Select 
                        value={formData.entrega_estado} 
                        onValueChange={(value) => setFormData({...formData, entrega_estado: value})}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {estados.map(estado => (
                            <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Contatos Adicionais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Contatos Adicionais</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Contato Financeiro */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Contato Financeiro</h4>
                    </div>
                    <Input
                      placeholder="Nome"
                      value={formData.contato_financeiro_nome}
                      onChange={(e) => setFormData({...formData, contato_financeiro_nome: e.target.value})}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={formData.contato_financeiro_email}
                      onChange={(e) => setFormData({...formData, contato_financeiro_email: e.target.value})}
                    />
                    <Input
                      placeholder="Telefone"
                      value={formData.contato_financeiro_telefone}
                      onChange={(e) => setFormData({...formData, contato_financeiro_telefone: e.target.value})}
                    />
                  </div>

                  {/* Contato Comercial */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">Contato Comercial</h4>
                    </div>
                    <Input
                      placeholder="Nome"
                      value={formData.contato_comercial_nome}
                      onChange={(e) => setFormData({...formData, contato_comercial_nome: e.target.value})}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={formData.contato_comercial_email}
                      onChange={(e) => setFormData({...formData, contato_comercial_email: e.target.value})}
                    />
                    <Input
                      placeholder="Telefone"
                      value={formData.contato_comercial_telefone}
                      onChange={(e) => setFormData({...formData, contato_comercial_telefone: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informações Comerciais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Informações Comerciais</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tempo_atuacao">Tempo de Atuação no Mercado</Label>
                    <Select 
                      value={formData.tempo_atuacao} 
                      onValueChange={(value) => setFormData({...formData, tempo_atuacao: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="menos_1_ano">Menos de 1 ano</SelectItem>
                        <SelectItem value="1_3_anos">1 a 3 anos</SelectItem>
                        <SelectItem value="3_5_anos">3 a 5 anos</SelectItem>
                        <SelectItem value="5_10_anos">5 a 10 anos</SelectItem>
                        <SelectItem value="mais_10_anos">Mais de 10 anos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numero_funcionarios">Número de Funcionários</Label>
                    <Select 
                      value={formData.numero_funcionarios} 
                      onValueChange={(value) => setFormData({...formData, numero_funcionarios: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1_5">1 a 5</SelectItem>
                        <SelectItem value="6_10">6 a 10</SelectItem>
                        <SelectItem value="11_20">11 a 20</SelectItem>
                        <SelectItem value="21_50">21 a 50</SelectItem>
                        <SelectItem value="mais_50">Mais de 50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="observacoes">Observações / Informações Adicionais</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                      placeholder="Conte-nos mais sobre sua loja, objetivos, ou outras informações relevantes..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Importante:</strong> Após enviar suas informações, nossa equipe 
                  entrará em contato em até 24 horas para prosseguir com o cadastro e configuração do acesso ao portal.
                </p>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
              >
                {loading ? 'Enviando...' : (
                  <>
                    Enviar Solicitação
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}