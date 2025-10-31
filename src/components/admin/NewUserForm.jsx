import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PendingUser } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
import { Users, Building, Shield, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const permissionsTemplates = {
  multimarca: {
    ver_dashboard: true,
    ver_catalogo: true,
    ver_capsulas: true,
    fazer_pedidos: true,
    ver_meus_pedidos: true,
    ver_pronta_entrega: true
  },
  fornecedor: {
    ver_dashboard: true,
    ver_catalogo: true,
    cadastrar_produtos: true,
    editar_produtos: true,
    ver_todos_pedidos: true,
    gerenciar_pedidos: true,
    ver_relatorios: true
  },
  admin: {
    ver_dashboard: true,
    ver_catalogo: true,
    ver_capsulas: true,
    ver_pronta_entrega: true,
    ver_programacao: true,
    fazer_pedidos: true,
    ver_meus_pedidos: true,
    ver_todos_pedidos: true,
    gerenciar_pedidos: true,
    cadastrar_produtos: true,
    editar_produtos: true,
    gerenciar_usuarios: true,
    ver_crm: true,
    gerenciar_fornecedores: true,
    ver_relatorios: true,
    ver_precos_custo: true,
    exportar_dados: true
  }
};

export default function NewUserForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password_temporaria: '',
    role: 'user',
    tipo_negocio: 'multimarca',
    fornecedor_id: '',
    nome_empresa: '',
    cnpj: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    permissoes: permissionsTemplates.multimarca,
    observacoes: ''
  });
  const [fornecedores, setFornecedores] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fornecedoresList, user] = await Promise.all([
          Fornecedor.list(),
          User.me()
        ]);
        setFornecedores(fornecedoresList);
        setCurrentUser(user);
      } catch (error) {
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    // Atualizar permissões quando o tipo muda
    setFormData(prev => ({
      ...prev,
      permissoes: permissionsTemplates[prev.tipo_negocio] || permissionsTemplates.multimarca
    }));
  }, [formData.tipo_negocio]);

  const handlePermissionChange = (permission, checked) => {
    setFormData(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [permission]: checked
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Preparar dados para salvar
      const dataToSave = {
        ...formData,
        status: 'pendente'
        // created_at é gerado automaticamente pelo banco
      };

      // Remover campos UUID vazios (PostgreSQL não aceita string vazia em UUID)
      if (!dataToSave.fornecedor_id) {
        delete dataToSave.fornecedor_id;
      }
      if (!dataToSave.contact_id) {
        delete dataToSave.contact_id;
      }

      await PendingUser.create(dataToSave);
      
      toast.info('Usuário ')${formData.full_name}" foi registrado com sucesso!

✅ CONFIGURADO:
• Email: ${formData.email}
• Perfil: ${formData.role === 'admin' ? 'Administrador' : 'Usuário'}
• Credenciais geradas e enviadas por email
• Usuário já pode fazer login

As informações detalhadas estão na aba "Usuários Pendentes".`);
      
      onSuccess();
    } catch (error) {
      toast.error('Falha ao registrar usuário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Registrar Novo Usuário
        </CardTitle>
        <CardDescription>
          Registre um novo usuário no sistema com acesso imediato.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Como funciona:</strong> Você preenche os dados aqui, o sistema cria o usuário automaticamente e envia um email com as credenciais de acesso. O usuário pode fazer login imediatamente.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Básicos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
              <Users className="w-5 h-5" />
              Dados Básicos
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_temporaria">Senha Temporária *</Label>
                <Input
                  id="password_temporaria"
                  type="password"
                  value={formData.password_temporaria}
                  onChange={e => setFormData({...formData, password_temporaria: e.target.value})}
                  required
                  placeholder="Senha para referência"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Tipo de Usuário */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
              <Shield className="w-5 h-5" />
              Tipo de Usuário
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="role">Função no Sistema</Label>
                <Select value={formData.role} onValueChange={value => setFormData({...formData, role: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo_negocio">Tipo de Negócio</Label>
                <Select 
                  value={formData.tipo_negocio} 
                  onValueChange={value => setFormData({...formData, tipo_negocio: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multimarca">Multimarca/Cliente</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campo Fornecedor - só aparece se tipo for fornecedor */}
            {formData.tipo_negocio === 'fornecedor' && (
              <div className="space-y-2">
                <Label htmlFor="fornecedor_id">Fornecedor Associado *</Label>
                <Select 
                  value={formData.fornecedor_id} 
                  onValueChange={value => setFormData({...formData, fornecedor_id: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(fornecedor => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome_marca} - {fornecedor.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Dados da Empresa - só para multimarca */}
          {formData.tipo_negocio === 'multimarca' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                <Building className="w-5 h-5" />
                Dados da Empresa
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
                  <Input
                    id="nome_empresa"
                    value={formData.nome_empresa}
                    onChange={e => setFormData({...formData, nome_empresa: e.target.value})}
                    required={formData.tipo_negocio === 'multimarca'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={e => setFormData({...formData, cnpj: e.target.value})}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={e => setFormData({...formData, endereco: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={e => setFormData({...formData, cidade: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select value={formData.estado} onValueChange={value => setFormData({...formData, estado: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estados.map(estado => (
                        <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={e => setFormData({...formData, cep: e.target.value})}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Permissões */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Permissões de Acesso</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(formData.permissoes).map(([permission, value]) => (
                <div key={permission} className="flex items-center space-x-2">
                  <Checkbox
                    id={permission}
                    checked={value}
                    onCheckedChange={(checked) => handlePermissionChange(permission, checked)}
                  />
                  <Label htmlFor={permission} className="text-sm">
                    {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input
              id="observacoes"
              value={formData.observacoes}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
              placeholder="Observações adicionais sobre o usuário..."
            />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Registrando...' : 'Registrar Usuário'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}