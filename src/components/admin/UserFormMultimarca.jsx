import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Users, Store, Settings, Plus, Trash2, MapPin, Loader2 } from 'lucide-react';
import { consultarCep, formatCepForDisplay } from '@/lib/cepHelpers';
import { toast } from 'sonner';

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

const tiposCliente = [
  { value: 'franqueado', label: 'Franqueado' },
  { value: 'multimarca', label: 'Multimarca' },
  { value: 'revendedor', label: 'Revendedor' },
  { value: 'atacado', label: 'Atacado' },
  { value: 'varejo', label: 'Varejo' }
];

const emptyLoja = () => ({
  _key: Date.now() + Math.random(),
  categoria_cliente: '',
  codigo_cliente: '',
  cnpj: '',
  nome: '',
  nome_fantasia: '',
  transportadora_padrao: '',
  suframa: '',
  inscricao_estadual: '',
  cidade: '',
  estado: '',
  endereco_completo: '',
  cep: '',
  bairro: '',
  whatsapp: '',
  email: '',
  telefone: ''
});

export default function UserFormMultimarca({ onSubmit, onCancel, loading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    telefone: '',
    permissoes: permissoesPadraoMultimarca,
    observacoes: ''
  });
  const [lojas, setLojas] = useState([emptyLoja()]);
  const [showPassword, setShowPassword] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validar ao menos 1 loja com razão social e tipo de cliente preenchidos
    const lojasValidas = lojas.filter(l => l.nome.trim());
    if (lojasValidas.length === 0) {
      toast.info('Cadastre ao menos uma loja com Razao Social.');
      return;
    }
    const lojaSemTipo = lojasValidas.find(l => !l.categoria_cliente);
    if (lojaSemTipo) {
      toast.info('Selecione o Tipo de Cliente em todas as lojas.');
      return;
    }
    // Usar categoria da primeira loja como categoria padrão do usuário
    const userData = {
      ...formData,
      tipo_negocio: 'multimarca',
      categoria_cliente: lojasValidas[0].categoria_cliente,
      lojas: lojasValidas.map(({ _key, ...rest }) => rest)
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

  const addLoja = () => {
    setLojas(prev => [...prev, emptyLoja()]);
  };

  const removeLoja = (index) => {
    if (lojas.length <= 1) {
      toast.info('Ao menos uma loja é obrigatória.');
      return;
    }
    setLojas(prev => prev.filter((_, i) => i !== index));
  };

  const updateLoja = (index, field, value) => {
    setLojas(prev => prev.map((loja, i) => i === index ? { ...loja, [field]: value } : loja));
  };

  const handleCepLojaChange = async (index, cep) => {
    updateLoja(index, 'cep', cep);
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setBuscandoCep(prev => ({ ...prev, [index]: true }));
      try {
        const endereco = await consultarCep(cleanCep);
        setLojas(prev => prev.map((loja, i) => i === index ? {
          ...loja,
          cep: formatCepForDisplay(cleanCep),
          endereco_completo: endereco.endereco_completo,
          bairro: endereco.bairro || '',
          cidade: endereco.cidade,
          estado: endereco.estado
        } : loja));
      } catch {
        toast.error('CEP não encontrado.');
      } finally {
        setBuscandoCep(prev => ({ ...prev, [index]: false }));
      }
    }
  };

  const permissoesGroups = [
    {
      title: 'Catalogo e Produtos',
      icon: Store,
      permissions: [
        { key: 'ver_catalogo', label: 'Ver Catalogo' },
        { key: 'ver_capsulas', label: 'Ver Capsulas' },
        { key: 'ver_pronta_entrega', label: 'Ver Pronta Entrega' },
        { key: 'ver_programacao', label: 'Ver Programacao' }
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
      title: 'Relatorios',
      icon: Settings,
      permissions: [
        { key: 'ver_relatorios', label: 'Ver Relatorios' },
        { key: 'ver_precos_custo', label: 'Ver Precos de Custo' }
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
                <Label htmlFor="password">Senha Temporaria *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                    minLength={6}
                    placeholder="Minimo 6 caracteres"
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

          {/* Lojas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Store className="w-4 h-4" />
                Lojas <span className="text-sm font-normal text-gray-500">(minimo 1 obrigatoria)</span>
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addLoja}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Loja
              </Button>
            </div>

            <div className="space-y-6">
              {lojas.map((loja, index) => (
                <div key={loja._key} className="relative border rounded-lg p-4 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" />
                      Loja {index + 1}
                    </span>
                    {lojas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 px-2" onClick={() => removeLoja(index)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remover
                      </Button>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de Cliente *</Label>
                      <Select value={loja.categoria_cliente} onValueChange={value => updateLoja(index, 'categoria_cliente', value)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {tiposCliente.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cod. Cliente</Label>
                      <Input
                        value={loja.codigo_cliente}
                        onChange={e => updateLoja(index, 'codigo_cliente', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CNPJ</Label>
                      <Input
                        value={loja.cnpj}
                        onChange={e => updateLoja(index, 'cnpj', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Razao Social *</Label>
                      <Input
                        value={loja.nome}
                        onChange={e => updateLoja(index, 'nome', e.target.value)}
                        placeholder="Razao social da loja"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nome Fantasia</Label>
                      <Input
                        value={loja.nome_fantasia}
                        onChange={e => updateLoja(index, 'nome_fantasia', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Transportadora Padrao</Label>
                      <Input
                        value={loja.transportadora_padrao}
                        onChange={e => updateLoja(index, 'transportadora_padrao', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">SUFRAMA</Label>
                      <Input
                        value={loja.suframa}
                        onChange={e => updateLoja(index, 'suframa', e.target.value)}
                        placeholder="Quando aplicavel"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">IE (Inscricao Estadual)</Label>
                      <Input
                        value={loja.inscricao_estadual}
                        onChange={e => updateLoja(index, 'inscricao_estadual', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        CEP {buscandoCep[index] && <Loader2 className="w-3 h-3 animate-spin" />}
                      </Label>
                      <Input
                        value={loja.cep}
                        onChange={e => handleCepLojaChange(index, e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Endereco Completo
                      </Label>
                      <Input
                        value={loja.endereco_completo}
                        onChange={e => updateLoja(index, 'endereco_completo', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={loja.bairro}
                        onChange={e => updateLoja(index, 'bairro', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={loja.cidade}
                        onChange={e => updateLoja(index, 'cidade', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UF</Label>
                      <Select value={loja.estado} onValueChange={value => updateLoja(index, 'estado', value)}>
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {estados.map(uf => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input
                        value={loja.whatsapp}
                        onChange={e => updateLoja(index, 'whatsapp', e.target.value)}
                        placeholder="(XX) XXXXX-XXXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={loja.email}
                        onChange={e => updateLoja(index, 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={loja.telefone}
                        onChange={e => updateLoja(index, 'telefone', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Permissoes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Permissoes de Acesso
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

          {/* Observacoes */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observacoes</Label>
            <Input
              id="observacoes"
              value={formData.observacoes}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
              placeholder="Observacoes sobre este cliente..."
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
