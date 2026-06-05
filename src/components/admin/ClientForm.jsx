import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ClientForm({ user, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'multimarca',
    empresa: '',
    telefone: '',
    whatsapp: '',
    cnpj: '',
    endereco_completo: '',
    cidade: '',
    estado: '',
    cep: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      // Determinar o tipo correto do usuário
      // Franqueados podem ter tipo_negocio='franqueado' OU tipo_negocio='multimarca' com categoria_cliente='franqueado'
      let tipoUsuario = user.tipo_negocio || user.role || 'multimarca';
      if (user.categoria_cliente === 'franqueado' || user.tipo_negocio === 'franqueado') {
        tipoUsuario = 'franqueado';
      }

      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        password: '',
        role: tipoUsuario,
        empresa: user.empresa || '',
        telefone: user.telefone || '',
        whatsapp: user.whatsapp || '',
        cnpj: user.cnpj || '',
        endereco_completo: user.endereco_completo || '',
        cidade: user.cidade || '',
        estado: user.estado || '',
        cep: user.cep || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        // Validar senha
        if (!formData.password || formData.password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }

        // Verificar se email já existe (apenas ao criar novo usuário)
        try {
          const existingUsers = await User.list({
            filters: { email: formData.email }
          });

          if (existingUsers && existingUsers.length > 0) {
            toast.error('Este email já está cadastrado no sistema.');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Erro ao verificar email duplicado:', error);
          // Continuar mesmo se falhar a verificação
        }

        // Criar via Edge Function `create-user` (service_role). NAO usar
        // User.signup direto porque `supabase.auth.signUp` troca a sessao
        // do admin pela do novo user (deslogando o admin silenciosamente
        // e quebrando chamadas seguintes de Edge Function por permissao).
        const { data: cuData, error: cuError } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: formData.role,
            tipo_negocio: formData.role,
            categoria_cliente: formData.role === 'admin' ? 'admin' : formData.role,
            telefone: formData.telefone || null,
            ativo: true
          }
        });

        if (cuError) {
          const msg = cuError.context && typeof cuError.context.json === 'function'
            ? (await cuError.context.json().catch(() => ({})))?.error
            : cuError.message;
          toast.error(`Erro ao criar usuário: ${msg || 'falha desconhecida'}`);
          setLoading(false);
          return;
        }
        if (cuData?.error) {
          toast.error(`Erro ao criar usuário: ${cuData.error}`);
          setLoading(false);
          return;
        }

        const tipoLabel = {
          multimarca: 'Cliente Multimarca',
          fornecedor: 'Fornecedor',
          franqueado: 'Franqueado',
          admin: 'Administrador'
        }[formData.role] || 'Cliente';

        toast.success(`${tipoLabel} "${formData.full_name}" criado com sucesso!

✅ Acesso ao sistema:
• Login: ${formData.email}
• Senha: ${formData.password}
• Tipo: ${tipoLabel}`);

      } else {
        // Editar usuário existente
        const dataToSubmit = {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
          tipo_negocio: formData.role, // Manter sincronizado com role
          categoria_cliente: formData.role === 'admin' ? 'admin' : formData.role,
          empresa: formData.empresa || null,
          telefone: formData.telefone || null,
          whatsapp: formData.whatsapp || null,
          cnpj: formData.cnpj || null,
          endereco_completo: formData.endereco_completo || null,
          cidade: formData.cidade || null,
          estado: formData.estado || null,
          cep: formData.cep || null
        };

        await User.update(user.id, dataToSubmit);

        // Se informou nova senha, atualizar via Edge Function
        if (formData.password && formData.password.trim() !== '') {
          if (formData.password.length < 6) {
            toast.error('A senha deve ter no mínimo 6 caracteres.');
            setLoading(false);
            return;
          }

          try {
            const { data, error } = await supabase.functions.invoke('update-user-password', {
              body: {
                user_id: user.id,
                new_password: formData.password
              }
            });

            // Verificar erro na resposta HTTP
            if (error) {
              console.error('Erro ao atualizar senha (HTTP):', error);
              toast.error('Dados atualizados, mas não foi possível alterar a senha. Verifique se o usuário possui registro de autenticação.');
              onSuccess();
              return;
            }

            // Verificar erro no corpo da resposta
            if (data?.error) {
              console.error('Erro ao atualizar senha (resposta):', data.error);
              toast.error(`Dados atualizados, mas erro ao alterar senha: ${data.error}`);
              onSuccess();
              return;
            }

            toast.success('Dados e senha atualizados com sucesso!');
            onSuccess();
            return;
          } catch (senhaError) {
            console.error('Erro ao chamar Edge Function de senha:', senhaError);
            toast.error('Dados atualizados, mas erro ao alterar a senha. Tente novamente.');
            onSuccess();
            return;
          }
        }

        toast.success('Dados atualizados com sucesso!');
      }

      onSuccess();

    } catch (error) {
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
          {user ? 'Editar Cliente' : 'Novo Cliente'}
        </CardTitle>
        <CardDescription>
          {user ? 'Editando informações do cliente' : 'Cadastrar novo cliente com acesso ao sistema'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!user && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              <strong>Criação de Cliente:</strong> Este cliente terá acesso imediato ao sistema para fazer login, navegar pelo catálogo e realizar pedidos. Um email com as credenciais será enviado automaticamente.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção de Tipo de Cliente - Destacado no início */}
          {!user && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Tipo de Cliente *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, role: 'multimarca'})}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    formData.role === 'multimarca'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-2xl mb-1 ${formData.role === 'multimarca' ? 'text-blue-600' : 'text-gray-400'}`}>🏪</div>
                  <div className={`font-semibold ${formData.role === 'multimarca' ? 'text-blue-700' : 'text-gray-700'}`}>Multimarca</div>
                  <div className="text-xs text-gray-500 mt-1">Loja própria</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, role: 'franqueado'})}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    formData.role === 'franqueado'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-2xl mb-1 ${formData.role === 'franqueado' ? 'text-purple-600' : 'text-gray-400'}`}>🏢</div>
                  <div className={`font-semibold ${formData.role === 'franqueado' ? 'text-purple-700' : 'text-gray-700'}`}>Franqueado</div>
                  <div className="text-xs text-gray-500 mt-1">Franquia Polo</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, role: 'fornecedor'})}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    formData.role === 'fornecedor'
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-2xl mb-1 ${formData.role === 'fornecedor' ? 'text-green-600' : 'text-gray-400'}`}>🏭</div>
                  <div className={`font-semibold ${formData.role === 'fornecedor' ? 'text-green-700' : 'text-gray-700'}`}>Fornecedor</div>
                  <div className="text-xs text-gray-500 mt-1">Fabrica produtos</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, role: 'admin'})}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    formData.role === 'admin'
                      ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
                      : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-2xl mb-1 ${formData.role === 'admin' ? 'text-red-600' : 'text-gray-400'}`}>👑</div>
                  <div className={`font-semibold ${formData.role === 'admin' ? 'text-red-700' : 'text-gray-700'}`}>Admin</div>
                  <div className="text-xs text-gray-500 mt-1">Acesso total</div>
                </button>
              </div>
            </div>
          )}

          {/* Edição - mostra select simples */}
          {user && (
            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Cliente *</Label>
              <Select value={formData.role} onValueChange={value => setFormData({...formData, role: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="multimarca">Multimarca</SelectItem>
                  <SelectItem value="franqueado">Franqueado</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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

          <div className="space-y-2">
            <Label htmlFor="password">Senha {!user && '*'} {!user && <span className="text-xs text-gray-500">(mínimo 6 caracteres)</span>}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                required={!user}
                minLength={6}
                placeholder={user ? "Deixe em branco para manter a atual" : "Mínimo 6 caracteres"}
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

          {/* Informações da Loja/Empresa */}
          <div className="border-t pt-6 mt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informações da Loja/Empresa</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="empresa">Nome da Empresa/Loja</Label>
                <Input
                  id="empresa"
                  value={formData.empresa}
                  onChange={e => setFormData({...formData, empresa: e.target.value})}
                  placeholder="Nome comercial"
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
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={e => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="endereco_completo">Endereço Completo</Label>
              <Input
                id="endereco_completo"
                value={formData.endereco_completo}
                onChange={e => setFormData({...formData, endereco_completo: e.target.value})}
                placeholder="Rua, número, complemento, bairro"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-4">
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
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={e => setFormData({...formData, estado: e.target.value})}
                  placeholder="UF"
                  maxLength={2}
                />
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

          <div className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : (user ? 'Atualizar Cliente' : 'Criar Cliente')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}