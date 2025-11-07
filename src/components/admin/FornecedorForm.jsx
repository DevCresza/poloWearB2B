
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox import
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
import { Building, DollarSign, Mail, Phone, User as UserIcon, Shield, Truck, MapPin, Clock, CreditCard } from 'lucide-react'; // Added CreditCard icon

export default function FornecedorForm({ fornecedor, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    nome_marca: 'Polo Wear',
    razao_social: '',
    cnpj: '',
    inscricao_estadual: '',
    responsavel_user_id: '',
    pedido_minimo_valor: 0,
    email_fornecedor: '',
    senha_fornecedor: '',
    ativo_fornecedor: true,
    clientes_boleto_faturado: [], // New field for clients with invoiced bank slip
    contato_comercial_nome: '',
    contato_comercial_email: '',
    contato_comercial_telefone: '',
    contato_comercial_whatsapp: '',
    contato_envio_nome: '',
    contato_envio_email: '',
    contato_envio_telefone: '',
    contato_envio_whatsapp: '',
    contato_financeiro_nome: '',
    contato_financeiro_email: '',
    contato_financeiro_telefone: '',
    contato_financeiro_whatsapp: '',
    endereco_completo: '',
    cidade: '',
    estado: '',
    cep: '',
    prazo_producao_dias: 0,
    prazo_entrega_dias: 0,
    observacoes: ''
  });

  const [admins, setAdmins] = useState([]);
  const [clientes, setClientes] = useState([]); // New state for clients
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData(); // Changed from loadAdmins to loadData
    if (fornecedor) {
      setFormData({
        ...fornecedor,
        clientes_boleto_faturado: fornecedor.clientes_boleto_faturado || [] // Ensure array is initialized
      });
    }
  }, [fornecedor]);

  const loadData = async () => { // Modified function name and logic
    try {
      const usersList = await User.list();
      const adminsList = usersList.filter(u => u.role === 'admin');
      const clientesList = usersList.filter(u => u.tipo_negocio === 'multimarca'); // Filter for clients (multimarca)
      
      setAdmins(adminsList);
      setClientes(clientesList); // Set clients state
    } catch (error) {
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações obrigatórias
      if (!formData.razao_social) {
        toast.error('Por favor, preencha a Razão Social.');
        setLoading(false);
        return;
      }

      if (!formData.responsavel_user_id) {
        toast.error('Por favor, selecione um Responsável (Admin).');
        setLoading(false);
        return;
      }

      if (!formData.pedido_minimo_valor || formData.pedido_minimo_valor <= 0) {
        toast.error('Por favor, informe um valor de pedido mínimo válido.');
        setLoading(false);
        return;
      }

      if (fornecedor) {
        await Fornecedor.update(fornecedor.id, formData);
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await Fornecedor.create(formData);
        toast.success('Fornecedor criado com sucesso!');
      }
      onSuccess();
    } catch (error) {
      toast.error('Erro ao salvar fornecedor. Tente novamente.');
      console.error('Erro ao salvar fornecedor:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleClienteBoletoFaturado = (clienteId) => {
    const lista = formData.clientes_boleto_faturado || [];
    if (lista.includes(clienteId)) {
      setFormData({
        ...formData,
        clientes_boleto_faturado: lista.filter(id => id !== clienteId)
      });
    } else {
      setFormData({
        ...formData,
        clientes_boleto_faturado: [...lista, clienteId]
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-slate-100 rounded-3xl shadow-neumorphic">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Building className="w-6 h-6" />
            {fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="geral" className="w-full">
            {/* Updated grid-cols to 5 for the new "Pagamento" tab */}
            <TabsList className="grid w-full grid-cols-5 mb-6"> 
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="contatos">Contatos</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="pagamento">Pagamento</TabsTrigger> {/* New Tab Trigger */}
              <TabsTrigger value="operacional">Operacional</TabsTrigger>
            </TabsList>

            {/* Tab: Geral */}
            <TabsContent value="geral" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nome_marca">Nome da Marca *</Label>
                  <Select value={formData.nome_marca} onValueChange={(value) => setFormData({...formData, nome_marca: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Polo Wear">Polo Wear</SelectItem>
                      <SelectItem value="MX">MX</SelectItem>
                      <SelectItem value="Guirro">Guirro</SelectItem>
                      <SelectItem value="MGM">MGM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="razao_social">Razão Social *</Label>
                  <Input
                    id="razao_social"
                    required
                    value={formData.razao_social}
                    onChange={(e) => setFormData({...formData, razao_social: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricao_estadual"
                    value={formData.inscricao_estadual}
                    onChange={(e) => setFormData({...formData, inscricao_estadual: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel_user_id">Responsável (Admin) *</Label>
                  <Select value={formData.responsavel_user_id} onValueChange={(value) => setFormData({...formData, responsavel_user_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.map(admin => (
                        <SelectItem key={admin.id} value={admin.id}>{admin.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pedido_minimo_valor">Pedido Mínimo (R$) *</Label>
                  <Input
                    id="pedido_minimo_valor"
                    type="number"
                    step="0.01"
                    value={formData.pedido_minimo_valor}
                    onChange={(e) => setFormData({...formData, pedido_minimo_valor: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Acesso ao Portal
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="email_fornecedor">Email de Acesso</Label>
                    <Input
                      id="email_fornecedor"
                      type="email"
                      value={formData.email_fornecedor}
                      onChange={(e) => setFormData({...formData, email_fornecedor: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="senha_fornecedor">Senha</Label>
                    <Input
                      id="senha_fornecedor"
                      type="password"
                      value={formData.senha_fornecedor}
                      onChange={(e) => setFormData({...formData, senha_fornecedor: e.target.value})}
                      placeholder={fornecedor ? "Deixe em branco para manter a senha atual" : ""}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="ativo_fornecedor"
                    checked={formData.ativo_fornecedor}
                    onCheckedChange={(checked) => setFormData({...formData, ativo_fornecedor: checked})}
                  />
                  <Label htmlFor="ativo_fornecedor">Fornecedor Ativo no Sistema</Label>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Contatos */}
            <TabsContent value="contatos" className="space-y-8">
              {/* Contato Comercial */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-600" />
                  Contato Comercial
                  <Badge className="ml-2 bg-blue-100 text-blue-800">Recebe Pedidos</Badge>
                </h3>
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    <strong>Este contato receberá notificações de novos pedidos via e-mail e WhatsApp.</strong>
                  </AlertDescription>
                </Alert>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="contato_comercial_nome">Nome do Contato</Label>
                    <Input
                      id="contato_comercial_nome"
                      value={formData.contato_comercial_nome}
                      onChange={(e) => setFormData({...formData, contato_comercial_nome: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_comercial_email">Email</Label>
                    <Input
                      id="contato_comercial_email"
                      type="email"
                      value={formData.contato_comercial_email}
                      onChange={(e) => setFormData({...formData, contato_comercial_email: e.target.value})}
                      placeholder="comercial@fornecedor.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_comercial_whatsapp">WhatsApp</Label>
                    <Input
                      id="contato_comercial_whatsapp"
                      value={formData.contato_comercial_whatsapp}
                      onChange={(e) => setFormData({...formData, contato_comercial_whatsapp: e.target.value})}
                      placeholder="+5511999999999"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contato Envio/Logística */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-green-600" />
                  Contato Envio/Logística
                  <Badge className="ml-2 bg-green-100 text-green-800">Recebe Pedidos</Badge>
                </h3>
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">
                    <strong>Este contato também receberá notificações de novos pedidos via e-mail e WhatsApp.</strong>
                  </AlertDescription>
                </Alert>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="contato_envio_nome">Nome do Contato</Label>
                    <Input
                      id="contato_envio_nome"
                      value={formData.contato_envio_nome}
                      onChange={(e) => setFormData({...formData, contato_envio_nome: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_envio_email">Email</Label>
                    <Input
                      id="contato_envio_email"
                      type="email"
                      value={formData.contato_envio_email}
                      onChange={(e) => setFormData({...formData, contato_envio_email: e.target.value})}
                      placeholder="logistica@fornecedor.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_envio_whatsapp">WhatsApp</Label>
                    <Input
                      id="contato_envio_whatsapp"
                      value={formData.contato_envio_whatsapp}
                      onChange={(e) => setFormData({...formData, contato_envio_whatsapp: e.target.value})}
                      placeholder="+5511999999999"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contato Financeiro */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                  Contato Financeiro
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="contato_financeiro_nome">Nome do Contato</Label>
                    <Input
                      id="contato_financeiro_nome"
                      value={formData.contato_financeiro_nome}
                      onChange={(e) => setFormData({...formData, contato_financeiro_nome: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_financeiro_email">Email</Label>
                    <Input
                      id="contato_financeiro_email"
                      type="email"
                      value={formData.contato_financeiro_email}
                      onChange={(e) => setFormData({...formData, contato_financeiro_email: e.target.value})}
                      placeholder="financeiro@fornecedor.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_financeiro_telefone">Telefone</Label>
                    <Input
                      id="contato_financeiro_telefone"
                      value={formData.contato_financeiro_telefone}
                      onChange={(e) => setFormData({...formData, contato_financeiro_telefone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contato_financeiro_whatsapp">WhatsApp</Label>
                    <Input
                      id="contato_financeiro_whatsapp"
                      value={formData.contato_financeiro_whatsapp}
                      onChange={(e) => setFormData({...formData, contato_financeiro_whatsapp: e.target.value})}
                      placeholder="+5511999999999"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Endereço */}
            <TabsContent value="endereco" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Endereço da Fábrica/Matriz
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="endereco_completo">Endereço Completo</Label>
                    <Textarea
                      id="endereco_completo"
                      value={formData.endereco_completo}
                      onChange={(e) => setFormData({...formData, endereco_completo: e.target.value})}
                      placeholder="Rua, número, complemento"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="estado">Estado</Label>
                    <Select value={formData.estado} onValueChange={(value) => setFormData({...formData, estado: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => setFormData({...formData, cep: e.target.value})}
                      placeholder="00000-000"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* New Tab: Pagamento */}
            <TabsContent value="pagamento" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Clientes com Boleto Faturado
                </h3>

                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    <strong>Selecione os clientes que poderão usar a opção "Boleto Faturado" ao fazer pedidos.</strong>
                    <br />
                    Clientes não selecionados verão apenas as opções PIX e Cartão de Crédito.
                  </AlertDescription>
                </Alert>

                {clientes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum cliente cadastrado no sistema ainda.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2"> {/* Added pr-2 for scrollbar spacing */}
                    {clientes.map((cliente) => (
                      <div
                        key={cliente.id}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`cliente-${cliente.id}`}
                            checked={(formData.clientes_boleto_faturado || []).includes(cliente.id)}
                            onCheckedChange={() => toggleClienteBoletoFaturado(cliente.id)}
                          />
                          <div>
                            <label
                              htmlFor={`cliente-${cliente.id}`}
                              className="font-medium text-gray-900 cursor-pointer"
                            >
                              {cliente.nome_empresa || cliente.full_name}
                            </label>
                            <p className="text-sm text-gray-600">{cliente.email}</p>
                            {cliente.codigo_cliente && (
                              <p className="text-xs text-gray-500">Código: {cliente.codigo_cliente}</p>
                            )}
                          </div>
                        </div>
                        
                        {(formData.clientes_boleto_faturado || []).includes(cliente.id) && (
                          <Badge className="bg-green-100 text-green-800">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Boleto Faturado Liberado
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Total de clientes selecionados:</strong> {(formData.clientes_boleto_faturado || []).length}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Tab: Operacional */}
            <TabsContent value="operacional" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Prazos e Observações
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="prazo_producao_dias">Prazo de Produção (dias)</Label>
                    <Input
                      id="prazo_producao_dias"
                      type="number"
                      value={formData.prazo_producao_dias}
                      onChange={(e) => setFormData({...formData, prazo_producao_dias: parseInt(e.target.value) || 0})}
                      placeholder="Ex: 15"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prazo_entrega_dias">Prazo de Entrega (dias)</Label>
                    <Input
                      id="prazo_entrega_dias"
                      type="number"
                      value={formData.prazo_entrega_dias}
                      onChange={(e) => setFormData({...formData, prazo_entrega_dias: parseInt(e.target.value) || 0})}
                      placeholder="Ex: 5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações Gerais</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    placeholder="Informações adicionais sobre o fornecedor..."
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Salvando...' : fornecedor ? 'Atualizar Fornecedor' : 'Criar Fornecedor'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
