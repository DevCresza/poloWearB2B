import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
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
  ShoppingBag, Calendar, Edit, Save, X, Shield, Package, DollarSign, Loader2, Camera, Upload
} from 'lucide-react';
import { consultarCep, formatCepForDisplay } from '@/lib/cepHelpers';
import { uploadAvatar, updateAvatar, getDefaultAvatar } from '@/lib/avatarHelpers';
import AvatarEditor from '@/components/AvatarEditor';
import { formatCurrency } from '@/utils/exportUtils';

export default function MeuPerfil() {
  const [user, setUser] = useState(null);
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

      if (currentUser.tipo_negocio === 'multimarca') {
        const pedidosList = await Pedido.filter({ comprador_user_id: currentUser.id });
        setPedidos(pedidosList || []);
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

      {/* Tabs com Informações */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <Tabs defaultValue="pessoal">
          <CardHeader>
            <TabsList className={`grid w-full ${user.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
              {user.role === 'admin' && (
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