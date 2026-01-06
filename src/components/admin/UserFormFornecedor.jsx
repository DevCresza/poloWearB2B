import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Fornecedor } from '@/api/entities';
import { Eye, EyeOff, Building, Settings, Package, BarChart } from 'lucide-react';
import { toast } from 'sonner';

const permissoesPadraoFornecedor = {
  ver_dashboard: true,
  ver_catalogo: false,
  ver_capsulas: false,
  ver_pronta_entrega: false,
  ver_programacao: false,
  fazer_pedidos: false,
  ver_meus_pedidos: false,
  ver_todos_pedidos: true,
  gerenciar_pedidos: true,
  cadastrar_produtos: true,
  editar_produtos: true,
  gerenciar_usuarios: false,
  ver_crm: false,
  gerenciar_fornecedores: false,
  ver_relatorios: true,
  ver_precos_custo: true,
  exportar_dados: true
};

export default function UserFormFornecedor({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    fornecedor_id: '',
    telefone: '',
    permissoes: permissoesPadraoFornecedor,
    observacoes: ''
  });
  const [fornecedores, setFornecedores] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loadFornecedores = async () => {
      try {
        const fornecedoresList = await Fornecedor.list();
        setFornecedores(fornecedoresList || []);
      } catch (_error) {
      }
    };
    loadFornecedores();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validações obrigatórias
    if (!formData.full_name) {
      toast.error('Por favor, preencha o nome completo.');
      return;
    }

    if (!formData.email) {
      toast.error('Por favor, preencha o email.');
      return;
    }

    if (!formData.fornecedor_id) {
      toast.error('Por favor, selecione um fornecedor.');
      return;
    }

    const userData = {
      ...formData,
      tipo_negocio: 'fornecedor'
      // role será definido automaticamente como tipo_negocio no helper
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
      title: 'Produtos',
      icon: Package,
      permissions: [
        { key: 'cadastrar_produtos', label: 'Cadastrar Produtos' },
        { key: 'editar_produtos', label: 'Editar Produtos' },
        { key: 'ver_precos_custo', label: 'Ver Preços de Custo' }
      ]
    },
    {
      title: 'Pedidos',
      icon: Building,
      permissions: [
        { key: 'ver_todos_pedidos', label: 'Ver Todos os Pedidos' },
        { key: 'gerenciar_pedidos', label: 'Gerenciar Pedidos' }
      ]
    },
    {
      title: 'Relatórios',
      icon: BarChart,
      permissions: [
        { key: 'ver_relatorios', label: 'Ver Relatórios' },
        { key: 'exportar_dados', label: 'Exportar Dados' }
      ]
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          Novo Usuário de Fornecedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building className="w-4 h-4" />
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

          {/* Fornecedor */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building className="w-4 h-4" />
              Fornecedor
            </h3>
            <div className="space-y-2">
              <Label htmlFor="fornecedor_id">Selecione o Fornecedor *</Label>
              <Select value={formData.fornecedor_id} onValueChange={value => setFormData({...formData, fornecedor_id: value})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um fornecedor" />
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
          </div>

          <Separator />

          {/* Permissões */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Permissões de Acesso
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
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
              placeholder="Observações sobre este usuário..."
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