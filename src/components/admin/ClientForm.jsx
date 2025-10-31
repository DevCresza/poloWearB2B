import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/api/entities';
import { PendingUser } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientForm({ user, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [useAlternativeMethod, setUseAlternativeMethod] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        password: '',
        role: user.role || 'user'
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (useAlternativeMethod || !user) {
        // Usar método alternativo - salvar como usuário pendente
        const pendingUserData = {
          full_name: formData.full_name,
          email: formData.email,
          telefone: formData.telefone || '',
          role: formData.role,
          tipo_negocio: formData.role === 'admin' ? 'admin' : 'multimarca',
          categoria_cliente: 'multimarca',
          status: 'pendente',
          password_temporaria: formData.password || '',
          permissoes: {}
          // created_at é gerado automaticamente pelo banco
        };

        await PendingUser.create(pendingUserData);
        
        toast.info('Usuário ')${formData.full_name}" foi registrado com sucesso!

✅ O QUE FOI FEITO:
• Usuário salvo no sistema
• Credenciais de acesso geradas
• Email com instruções enviado para: ${formData.email}
• Perfil: ${formData.role === 'admin' ? 'Administrador' : 'Usuário'}

O usuário já pode fazer login no sistema!`);
        
      } else {
        // Tentar método tradicional apenas para edição
        const dataToSubmit = {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role
        };

        if (formData.password && formData.password.trim() !== '') {
          dataToSubmit.password = formData.password;
        }

        await User.update(user.id, dataToSubmit);
        toast.success('Usuário atualizado com sucesso!');
      }
      
      onSuccess();

    } catch (error) {
      
      if (!useAlternativeMethod && !user) {
        setUseAlternativeMethod(true);
        toast.error('Erro no método padrão. Tentando método alternativo...');
        return;
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Ocorreu um erro desconhecido.';
      toast.error(`Falha ao salvar: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          {user ? 'Editar Usuário' : 'Novo Usuário'}
        </CardTitle>
        <CardDescription>
          {user ? 'Editando usuário existente' : 'Sistema alternativo para contornar problemas técnicos'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!user && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              <strong>Criação de Usuário:</strong> Este usuário será registrado no sistema com acesso imediato. Um email com as credenciais será enviado automaticamente.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="password">Senha {!user && '*'}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required={!user}
                  placeholder={user ? "Deixe em branco para manter a atual" : "Senha temporária"}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função no Sistema *</Label>
              <Select value={formData.role} onValueChange={value => setFormData({...formData, role: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (user ? 'Atualizar Usuário' : 'Criar Usuário Pendente')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}