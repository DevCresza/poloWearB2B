import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  User as UserIcon, Building, MapPin, Phone, Mail, CreditCard,
  ShoppingBag, Calendar, Edit, Save, X, Shield, Package, DollarSign, Loader2, Camera, Upload,
  Store, Plus, Pencil, Power
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { consultarCep, formatCepForDisplay } from '@/lib/cepHelpers';
import { uploadAvatar, updateAvatar, getDefaultAvatar } from '@/lib/avatarHelpers';
import AvatarEditor from '@/components/AvatarEditor';
import { formatCurrency } from '@/utils/exportUtils';
import { Loja } from '@/api/entities';
import { useLojaContext } from '@/contexts/LojaContext';

export default function MeuPerfil() {
  const [user, setUser] = useState(null);
  const [fornecedor, setFornecedor] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [formData, setFormData] = useState({});

  // Lojas
  const [lojas, setLojas] = useState([]);
  const [showLojaModal, setShowLojaModal] = useState(false);
  const [lojaEditando, setLojaEditando] = useState(null);
  const [salvandoLoja, setSalvandoLoja] = useState(false);
  const [buscandoCepLoja, setBuscandoCepLoja] = useState(false);
  const [lojaFormData, setLojaFormData] = useState({
    nome: '', nome_fantasia: '', cnpj: '', codigo_cliente: '',
    endereco_completo: '', cidade: '', estado: '', cep: '', telefone: ''
  });
  const lojaCtx = useLojaContext();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setFormData({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
        telefone: currentUser.telefone || '',
        whatsapp: currentUser.whatsapp || '',
        empresa: currentUser.empresa || '',
        cnpj: currentUser.cnpj || '',
        endereco_completo: currentUser.endereco_completo || '',
        cidade: currentUser.cidade || '',
        estado: currentUser.estado || '',
        cep: currentUser.cep || ''
      });

      if (currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'franqueado') {
        const [pedidosList, lojasList] = await Promise.all([
          Pedido.filter({ comprador_user_id: currentUser.id }),
          Loja.filter({ user_id: currentUser.id })
        ]);
        setPedidos(pedidosList || []);
        setLojas(lojasList || []);
      } else if (currentUser.tipo_negocio === 'fornecedor') {
        // Carregar dados do fornecedor
        let fornecedorData = null;
        if (currentUser.fornecedor_id) {
          fornecedorData = await Fornecedor.get(currentUser.fornecedor_id);
        } else {
          // Fallback: buscar fornecedor pelo responsavel_user_id
          const fornecedoresList = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
          fornecedorData = fornecedoresList[0];
        }
        if (fornecedorData) {
          setFornecedor(fornecedorData);
          // Preencher formData com dados do fornecedor quando disponíveis
          setFormData(prev => ({
            ...prev,
            empresa: fornecedorData.razao_social || fornecedorData.nome_fantasia || prev.empresa,
            cnpj: fornecedorData.cnpj || prev.cnpj,
            telefone: fornecedorData.telefone || prev.telefone,
            whatsapp: fornecedorData.contato_comercial_whatsapp || prev.whatsapp,
            endereco_completo: fornecedorData.endereco_completo || prev.endereco_completo,
            cidade: fornecedorData.cidade || prev.cidade,
            estado: fornecedorData.estado || prev.estado,
            cep: fornecedorData.cep || prev.cep
          }));
        }
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      await User.updateProfile(formData);
      toast.success('Perfil atualizado com sucesso!');
      setEditando(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar perfil.');
    } finally {
      setSalvando(false);
    }
  };

  const handleCepChange = async (cep) => {
    // Atualiza o formData com o CEP
    setFormData({ ...formData, cep });

    // Remove formatação e verifica se tem 8 dígitos
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length === 8) {
      setBuscandoCep(true);
      try {
        const endereco = await consultarCep(cleanCep);

        // Atualiza todos os campos de endereço
        setFormData(prev => ({
          ...prev,
          cep: formatCepForDisplay(cleanCep),
          endereco_completo: endereco.endereco_completo,
          cidade: endereco.cidade,
          estado: endereco.estado
        }));

      } catch (error) {
        toast.error('CEP não encontrado. Verifique o número digitado.');
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.');
      return;
    }

    // Validar tamanho (máx 10MB antes de editar)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.info('Arquivo muito grande. O tamanho máximo é 10MB.');
      return;
    }

    // Converter para base64 e abrir editor
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setShowEditor(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEditedAvatar = async (croppedImageBlob) => {
    setUploadingAvatar(true);
    try {
      // Converter Blob para File
      const file = new File([croppedImageBlob], 'avatar.jpg', {
        type: 'image/jpeg'
      });

      // Upload do avatar editado
      const result = await updateAvatar(file, user.id, user.avatar_url);

      // Atualizar perfil com nova URL do avatar
      await User.updateProfile({ avatar_url: result.url });

      // Mostrar preview
      setAvatarPreview(result.url);

      toast.success('Avatar atualizado com sucesso!');
      loadData(); // Recarregar dados do usuário
    } catch (error) {
      toast.error(`Erro ao atualizar avatar: ${error.message}`);
    } finally {
      setUploadingAvatar(false);
      setSelectedImage(null);
    }
  };

  // ---- Lojas CRUD ----
  const abrirModalLoja = (loja = null) => {
    if (loja) {
      setLojaEditando(loja);
      setLojaFormData({
        nome: loja.nome || '',
        nome_fantasia: loja.nome_fantasia || '',
        cnpj: loja.cnpj || '',
        codigo_cliente: loja.codigo_cliente || '',
        endereco_completo: loja.endereco_completo || '',
        cidade: loja.cidade || '',
        estado: loja.estado || '',
        cep: loja.cep || '',
        telefone: loja.telefone || ''
      });
    } else {
      setLojaEditando(null);
      setLojaFormData({
        nome: '', nome_fantasia: '', cnpj: '', codigo_cliente: '',
        endereco_completo: '', cidade: '', estado: '', cep: '', telefone: ''
      });
    }
    setShowLojaModal(true);
  };

  const handleCepLojaChange = async (cep) => {
    setLojaFormData(prev => ({ ...prev, cep }));
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setBuscandoCepLoja(true);
      try {
        const endereco = await consultarCep(cleanCep);
        setLojaFormData(prev => ({
          ...prev,
          cep: formatCepForDisplay(cleanCep),
          endereco_completo: endereco.endereco_completo,
          cidade: endereco.cidade,
          estado: endereco.estado
        }));
      } catch (_err) {
        toast.error('CEP não encontrado.');
      } finally {
        setBuscandoCepLoja(false);
      }
    }
  };

  const handleSalvarLoja = async () => {
    if (!lojaFormData.nome.trim()) {
      toast.info('Informe o nome/razão social da loja.');
      return;
    }
    setSalvandoLoja(true);
    try {
      if (lojaEditando) {
        await Loja.update(lojaEditando.id, lojaFormData);
        toast.success('Loja atualizada com sucesso!');
      } else {
        await Loja.create({ ...lojaFormData, user_id: user.id, ativa: true });
        toast.success('Loja cadastrada com sucesso!');
      }
      setShowLojaModal(false);
      // Reload lojas
      const lojasList = await Loja.filter({ user_id: user.id });
      setLojas(lojasList || []);
      if (lojaCtx.loadLojas) lojaCtx.loadLojas();
    } catch (_err) {
      toast.error('Erro ao salvar loja.');
    } finally {
      setSalvandoLoja(false);
    }
  };

  const handleDesativarLoja = async (loja) => {
    if (!confirm(`Deseja desativar a loja "${loja.nome_fantasia || loja.nome}"?`)) return;
    try {
      await Loja.update(loja.id, { ativa: false });
      toast.success('Loja desativada.');
      const lojasList = await Loja.filter({ user_id: user.id });
      setLojas(lojasList || []);
      if (lojaCtx.loadLojas) lojaCtx.loadLojas();
    } catch (_err) {
      toast.error('Erro ao desativar loja.');
    }
  };

  const handleReativarLoja = async (loja) => {
    try {
      await Loja.update(loja.id, { ativa: true });
      toast.success('Loja reativada.');
      const lojasList = await Loja.filter({ user_id: user.id });
      setLojas(lojasList || []);
      if (lojaCtx.loadLojas) lojaCtx.loadLojas();
    } catch (_err) {
      toast.error('Erro ao reativar loja.');
    }
  };

  const calcularEstatisticas = () => {
    const totalPedidos = pedidos.length;
    const valorTotal = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const pedidosFinalizados = pedidos.filter(p => p.status === 'finalizado').length;
    const pedidosAndamento = pedidos.filter(p => 
      ['novo_pedido', 'em_analise', 'aprovado', 'em_producao', 'faturado', 'em_transporte'].includes(p.status)
    ).length;

    return { totalPedidos, valorTotal, pedidosFinalizados, pedidosAndamento };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = calcularEstatisticas();
  const isCliente = user?.tipo_negocio === 'multimarca' || user?.tipo_negocio === 'franqueado';

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-6">
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-600">Gerencie suas informações pessoais e de empresa</p>
        </div>
        
        {!editando ? (
          <Button onClick={() => setEditando(true)} className="bg-blue-600 hover:bg-blue-700">
            <Edit className="w-4 h-4 mr-2" />
            Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditando(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={salvando} className="bg-green-600 hover:bg-green-700">
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        )}
      </div>

      {/* Status e Badges */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative group">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
                  {avatarPreview || user.avatar_url ? (
                    <img
                      src={avatarPreview || user.avatar_url}
                      alt={user.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user.full_name?.charAt(0)}</span>
                  )}
                </div>

                {/* Botão de upload (overlay) */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center cursor-pointer transition-all"
                >
                  <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  {uploadingAvatar && (
                    <Loader2 className="w-8 h-8 text-white animate-spin absolute" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
                <p className="text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-500 mt-1">Clique na foto para alterar</p>
              </div>
            </div>
            
            <div className="flex-1"></div>
            
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-100 text-blue-800 px-4 py-2">
                <Shield className="w-4 h-4 mr-2" />
                {user.role === 'admin' ? 'Administrador' : 'Usuário'}
              </Badge>
              <Badge className="bg-purple-100 text-purple-800 px-4 py-2">
                <Building className="w-4 h-4 mr-2" />
                {user.tipo_negocio === 'multimarca'
                  ? (user.categoria_cliente === 'franqueado' ? 'Franqueado' : 'Multimarca')
                  : user.tipo_negocio === 'fornecedor' ? 'Fornecedor' : 'Admin'}
              </Badge>
              {user.codigo_cliente && (
                <Badge className="bg-green-100 text-green-800 px-4 py-2">
                  Código: {user.codigo_cliente}
                </Badge>
              )}
              {user.bloqueado && (
                <Badge className="bg-red-100 text-red-800 px-4 py-2">
                  Bloqueado
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas (para clientes) */}
      {user.tipo_negocio === 'multimarca' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Total de Pedidos</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPedidos}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Valor Total Comprado</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.valorTotal)}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingBag className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">Pedidos Finalizados</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pedidosFinalizados}</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">Em Andamento</p>
              <p className="text-3xl font-bold text-gray-900">{stats.pedidosAndamento}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Informações do Fornecedor */}
      {user.tipo_negocio === 'fornecedor' && fornecedor && (
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-600" />
              Dados do Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fornecedor.razao_social && (
                <div>
                  <p className="text-sm text-gray-600">Razão Social</p>
                  <p className="font-semibold text-gray-900">{fornecedor.razao_social}</p>
                </div>
              )}
              {fornecedor.nome_fantasia && (
                <div>
                  <p className="text-sm text-gray-600">Nome Fantasia</p>
                  <p className="font-semibold text-gray-900">{fornecedor.nome_fantasia}</p>
                </div>
              )}
              {fornecedor.nome_marca && (
                <div>
                  <p className="text-sm text-gray-600">Marca</p>
                  <p className="font-semibold text-gray-900">{fornecedor.nome_marca}</p>
                </div>
              )}
              {fornecedor.cnpj && (
                <div>
                  <p className="text-sm text-gray-600">CNPJ</p>
                  <p className="font-semibold text-gray-900">{fornecedor.cnpj}</p>
                </div>
              )}
              {fornecedor.inscricao_estadual && (
                <div>
                  <p className="text-sm text-gray-600">Inscrição Estadual</p>
                  <p className="font-semibold text-gray-900">{fornecedor.inscricao_estadual}</p>
                </div>
              )}
              {fornecedor.telefone && (
                <div>
                  <p className="text-sm text-gray-600">Telefone</p>
                  <p className="font-semibold text-gray-900">{fornecedor.telefone}</p>
                </div>
              )}
              {fornecedor.email && (
                <div>
                  <p className="text-sm text-gray-600">Email do Fornecedor</p>
                  <p className="font-semibold text-gray-900">{fornecedor.email}</p>
                </div>
              )}
              {fornecedor.contato_comercial_whatsapp && (
                <div>
                  <p className="text-sm text-gray-600">WhatsApp Comercial</p>
                  <p className="font-semibold text-gray-900">{fornecedor.contato_comercial_whatsapp}</p>
                </div>
              )}
            </div>
            {(fornecedor.endereco_completo || fornecedor.cidade || fornecedor.estado) && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Endereço</p>
                  <p className="font-semibold text-gray-900">
                    {fornecedor.endereco_completo && `${fornecedor.endereco_completo}`}
                    {fornecedor.cidade && ` - ${fornecedor.cidade}`}
                    {fornecedor.estado && `/${fornecedor.estado}`}
                    {fornecedor.cep && ` - CEP: ${fornecedor.cep}`}
                  </p>
                </div>
              </>
            )}
            {fornecedor.observacoes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Observações</p>
                  <p className="text-gray-900">{fornecedor.observacoes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs com Informações */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <Tabs defaultValue="pessoal">
          <CardHeader>
            <TabsList className={`grid w-full ${
              isCliente ? 'grid-cols-3' : user.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'
            }`}>
              <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
              {isCliente && (
                <TabsTrigger value="lojas">
                  <Store className="w-4 h-4 mr-1" />
                  Minhas Lojas
                </TabsTrigger>
              )}
              {user.role === 'admin' && !isCliente && (
                <TabsTrigger value="permissoes">Permissões</TabsTrigger>
              )}
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Dados Pessoais */}
            <TabsContent value="pessoal" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name" className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Nome Completo
                  </Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="mt-1 bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
                </div>

                <div>
                  <Label htmlFor="telefone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                    disabled={!editando}
                    placeholder="(XX) XXXXX-XXXX"
                    className="mt-1"
                  />
                </div>

              </div>
            </TabsContent>

            {/* Dados da Empresa */}
            <TabsContent value="empresa" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="empresa" className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Nome da Empresa
                  </Label>
                  <Input
                    id="empresa"
                    value={formData.empresa}
                    onChange={(e) => setFormData({...formData, empresa: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cep" className="flex items-center gap-2">
                    CEP
                    {buscandoCep && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                  </Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    disabled={!editando || buscandoCep}
                    placeholder="00000-000"
                    maxLength={9}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="endereco_completo" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereço Completo
                  </Label>
                  <Textarea
                    id="endereco_completo"
                    value={formData.endereco_completo}
                    onChange={(e) => setFormData({...formData, endereco_completo: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                    disabled={!editando}
                    className="mt-1"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Minhas Lojas - Para clientes */}
            {isCliente && (
              <TabsContent value="lojas" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Minhas Lojas</h3>
                    <p className="text-sm text-gray-500">Gerencie as lojas vinculadas à sua conta</p>
                  </div>
                  <Button onClick={() => abrirModalLoja()} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Loja
                  </Button>
                </div>

                {lojas.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Nenhuma loja cadastrada</p>
                    <p className="text-sm text-gray-500 mb-4">Cadastre suas lojas para gerenciar pedidos e financeiro por unidade</p>
                    <Button onClick={() => abrirModalLoja()} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Cadastrar primeira loja
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lojas.map(loja => (
                      <Card key={loja.id} className={`${!loja.ativa ? 'opacity-60' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Store className="w-4 h-4 text-blue-600" />
                                {loja.nome_fantasia || loja.nome}
                              </h4>
                              {loja.nome_fantasia && loja.nome !== loja.nome_fantasia && (
                                <p className="text-xs text-gray-500">{loja.nome}</p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirModalLoja(loja)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {loja.ativa ? (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDesativarLoja(loja)}>
                                  <Power className="w-3.5 h-3.5" />
                                </Button>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-700" onClick={() => handleReativarLoja(loja)}>
                                  <Power className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            {loja.cnpj && <p><span className="text-gray-400">CNPJ:</span> {loja.cnpj}</p>}
                            {loja.codigo_cliente && <p><span className="text-gray-400">Código:</span> {loja.codigo_cliente}</p>}
                            {(loja.cidade || loja.estado) && (
                              <p className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {loja.cidade}{loja.estado ? `/${loja.estado}` : ''}
                              </p>
                            )}
                            {loja.telefone && <p><span className="text-gray-400">Tel:</span> {loja.telefone}</p>}
                          </div>
                          {!loja.ativa && (
                            <Badge className="mt-2 bg-red-100 text-red-800">Desativada</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {/* Permissões - Apenas para Admin */}
            {user.role === 'admin' && (
              <TabsContent value="permissoes" className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Suas permissões de acesso são gerenciadas pelos administradores do sistema.
                    Entre em contato caso precise solicitar alterações.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.permissoes && Object.entries(user.permissoes).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <Badge className={value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {value ? 'Permitido' : 'Bloqueado'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>

      {/* Informações Adicionais */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Membro desde:</span>
            <span className="font-semibold">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Último acesso:</span>
            <span className="font-semibold">
              {user.last_login ? new Date(user.last_login).toLocaleDateString('pt-BR') : 'Primeiro acesso'}
            </span>
          </div>
          {user.tipo_negocio === 'multimarca' && (
            <>
              <Separator />
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Total em aberto:</span>
                <span className="font-semibold text-orange-600">{formatCurrency(user.total_em_aberto || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Total vencido:</span>
                <span className="font-semibold text-red-600">{formatCurrency(user.total_vencido || 0)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Loja */}
      <Dialog open={showLojaModal} onOpenChange={setShowLojaModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              {lojaEditando ? 'Editar Loja' : 'Nova Loja'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Razão Social *</Label>
                <Input value={lojaFormData.nome} onChange={(e) => setLojaFormData({...lojaFormData, nome: e.target.value})} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label>Nome Fantasia</Label>
                <Input value={lojaFormData.nome_fantasia} onChange={(e) => setLojaFormData({...lojaFormData, nome_fantasia: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={lojaFormData.cnpj} onChange={(e) => setLojaFormData({...lojaFormData, cnpj: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label>Código do Cliente</Label>
                <Input value={lojaFormData.codigo_cliente} onChange={(e) => setLojaFormData({...lojaFormData, codigo_cliente: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  CEP {buscandoCepLoja && <Loader2 className="w-3 h-3 animate-spin" />}
                </Label>
                <Input value={lojaFormData.cep} onChange={(e) => handleCepLojaChange(e.target.value)} maxLength={9} placeholder="00000-000" className="mt-1" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={lojaFormData.telefone} onChange={(e) => setLojaFormData({...lojaFormData, telefone: e.target.value})} className="mt-1" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço Completo</Label>
                <Textarea value={lojaFormData.endereco_completo} onChange={(e) => setLojaFormData({...lojaFormData, endereco_completo: e.target.value})} rows={2} className="mt-1" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={lojaFormData.cidade} onChange={(e) => setLojaFormData({...lojaFormData, cidade: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={lojaFormData.estado} onChange={(e) => setLojaFormData({...lojaFormData, estado: e.target.value})} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowLojaModal(false)}>Cancelar</Button>
              <Button onClick={handleSalvarLoja} disabled={salvandoLoja} className="bg-blue-600 hover:bg-blue-700">
                {salvandoLoja ? 'Salvando...' : lojaEditando ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor de Avatar */}
      {selectedImage && (
        <AvatarEditor
          open={showEditor}
          onClose={() => {
            setShowEditor(false);
            setSelectedImage(null);
          }}
          imageSrc={selectedImage}
          onSave={handleSaveEditedAvatar}
        />
      )}
    </div>
  );
}