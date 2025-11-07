import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Settings, Users, Package, BarChart, Activity } from 'lucide-react';

const permissoesAdmin = {
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
};

export default function UserFormAdmin({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    telefone: '',
    permissoes: permissoesAdmin,
    observacoes: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Verificar se email já existe (apenas ao criar novo usuário)
    try {
      const { User } = await import('@/api/entities');
      const existingUsers = await User.list({
        filters: { email: formData.email }
      });

      if (existingUsers && existingUsers.length > 0) {
        const { toast } = await import('sonner');
        toast.error('Este email já está cadastrado no sistema.');
        return;
      }
    } catch (error) {
      console.error('Erro ao verificar email duplicado:', error);
      // Continuar mesmo se falhar a verificação
    }

    const userData = {
      ...formData,
      tipo_negocio: 'admin',
      role: 'admin'
    };
    onSubmit(userData);
  };

  const handlePermissaoChange = (permissao, checked) => {
    setFormData(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [permissao]: checked
      }
    }));
  };

  const permissoesGroups = [
    {
      title: 'Usuários e Acesso',
      icon: Users,
      permissions: [
        { key: 'gerenciar_usuarios', label: 'Gerenciar Usuários' },
        { key: 'ver_crm', label: 'Acessar CRM' }
      ]
    },
    {
      title: 'Produtos e Fornecedores',
      icon: Package,
      permissions: [
        { key: 'cadastrar_produtos', label: 'Cadastrar Produtos' },
        { key: 'editar_produtos', label: 'Editar Produtos' },
        { key: 'gerenciar_fornecedores', label: 'Gerenciar Fornecedores' }
      ]
    },
    {
      title: 'Pedidos e Vendas',
      icon: Activity,
      permissions: [
        { key: 'ver_todos_pedidos', label: 'Ver Todos os Pedidos' },
        { key: 'gerenciar_pedidos', label: 'Gerenciar Pedidos' }
      ]
    },
    {
      title: 'Relatórios e Dados',
      icon: BarChart,
      permissions: [
        { key: 'ver_relatorios', label: 'Ver Relatórios' },
        { key: 'ver_precos_custo', label: 'Ver Preços de Custo' },
        { key: 'exportar_dados', label: 'Exportar Dados' }
      ]
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Novo Administrador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6 border-red-200 bg-red-50">
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            <strong>Atenção:</strong> Administradores têm acesso completo ao sistema. Certifique-se de que esta pessoa é confiável.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Dados do Administrador
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
                <Label htmlFor="password">Senha Temporária *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Permissões */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Permissões Administrativas
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {permissoesGroups.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <group.icon className="w-4 h-4" />
                    {group.title}
                  </h4>
                  <div className="space-y-2 pl-6">
                    {group.permissions.map((perm) => (
                      <div key={perm.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={perm.key}
                          checked={formData.permissoes[perm.key]}
                          onCheckedChange={(checked) => handlePermissaoChange(perm.key, checked)}
                        />
                        <Label htmlFor={perm.key} className="text-sm">{perm.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input
              id="observacoes"
              value={formData.observacoes}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
              placeholder="Observações sobre este administrador..."
            />
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Administrador'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}