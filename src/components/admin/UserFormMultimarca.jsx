import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Users, Store, MapPin, Settings } from 'lucide-react';

const permissoesPadraoMultimarca = {
  ver_dashboard: true,
  ver_catalogo: true,
  ver_capsulas: true,
  ver_pronta_entrega: true,
  ver_programacao: false,
  fazer_pedidos: true,
  ver_meus_pedidos: true,
  ver_todos_pedidos: false,
  gerenciar_pedidos: false,
  cadastrar_produtos: false,
  editar_produtos: false,
  gerenciar_usuarios: false,
  ver_crm: false,
  gerenciar_fornecedores: false,
  ver_relatorios: false,
  ver_precos_custo: false,
  exportar_dados: false
};

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function UserFormMultimarca({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    nome_empresa: '',
    cnpj: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    permissoes: permissoesPadraoMultimarca,
    observacoes: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const userData = {
      ...formData,
      tipo_negocio: 'multimarca',
      categoria_cliente: 'multimarca' // Categoria padrão para clientes/franqueados
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
      title: 'Catálogo e Produtos',
      icon: Store,
      permissions: [
        { key: 'ver_catalogo', label: 'Ver Catálogo' },
        { key: 'ver_capsulas', label: 'Ver Cápsulas' },
        { key: 'ver_pronta_entrega', label: 'Ver Pronta Entrega' },
        { key: 'ver_programacao', label: 'Ver Programação' }
      ]
    },
    {
      title: 'Pedidos',
      icon: Users,
      permissions: [
        { key: 'fazer_pedidos', label: 'Fazer Pedidos' },
        { key: 'ver_meus_pedidos', label: 'Ver Meus Pedidos' }
      ]
    },
    {
      title: 'Relatórios',
      icon: Settings,
      permissions: [
        { key: 'ver_relatorios', label: 'Ver Relatórios' },
        { key: 'ver_precos_custo', label: 'Ver Preços de Custo' }
      ]
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Novo Cliente/Franqueado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Dados Pessoais
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

          {/* Dados da Empresa */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Store className="w-4 h-4" />
              Dados da Empresa
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
                <Input
                  id="nome_empresa"
                  value={formData.nome_empresa}
                  onChange={e => setFormData({...formData, nome_empresa: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={e => setFormData({...formData, cnpj: e.target.value})}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Localização
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={e => setFormData({...formData, endereco: e.target.value})}
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
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
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                  />
                </div>
              </div>
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
              placeholder="Observações sobre este cliente..."
            />
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Cliente'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}