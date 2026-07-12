import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Settings, Users, Package, BarChart, Activity } from 'lucide-react';

import { PAPEIS } from '@/utils/roles';

const PERFIS_INTERNOS = [
  {
    papel: PAPEIS.ADMIN,
    titulo: 'Administrador',
    descricao: 'Acesso geral: pedidos, faturamento, produtos, usuários, CRM e configurações.',
  },
  {
    papel: PAPEIS.VENDEDOR,
    titulo: 'Vendedor',
    descricao: 'Vê o catálogo e as cápsulas como as lojas veem, monta pedidos em nome do cliente e acompanha os pedidos. Não vê totais de faturamento nem custo.',
  },
  {
    papel: PAPEIS.CADASTRO,
    titulo: 'Cadastro',
    descricao: 'Cria, edita, ativa e desativa produtos e cápsulas (incluindo preços). Não vê pedidos nem faturamento.',
  },
];

export default function UserFormAdmin({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    telefone: '',
    papel: PAPEIS.ADMIN,
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

    // O papel define as permissoes (src/utils/permissoes.js). `permissoes` no
    // banco e legado e nao autoriza nada — nao mandamos mais.
    const userData = {
      ...formData,
      tipo_negocio: formData.papel,
      role: formData.papel,
    };
    delete userData.papel;
    delete userData.permissoes;
    onSubmit(userData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Novo Usuário Interno
        </CardTitle>
      </CardHeader>
      <CardContent>
        {formData.papel === PAPEIS.ADMIN && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              <strong>Atenção:</strong> Administradores têm acesso completo ao sistema. Certifique-se de que esta pessoa é confiável.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Dados do Usuário
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

          {/* Perfil de acesso.
              Antes eram checkboxes soltos gravados em users.permissoes — que o
              sistema NUNCA lia. Agora o acesso vem do papel. */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Perfil de Acesso
            </h3>
            <div className="grid gap-3">
              {PERFIS_INTERNOS.map((perfil) => (
                <label
                  key={perfil.papel}
                  className={`flex gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                    formData.papel === perfil.papel
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="papel"
                    className="mt-1"
                    checked={formData.papel === perfil.papel}
                    onChange={() => setFormData({ ...formData, papel: perfil.papel })}
                  />
                  <div>
                    <p className="font-medium text-gray-800">{perfil.titulo}</p>
                    <p className="text-sm text-gray-600">{perfil.descricao}</p>
                  </div>
                </label>
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
              {loading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}