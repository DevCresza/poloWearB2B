
import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, Plus, Edit, UserCheck, MessageSquare, Trash2, Store, Download } from 'lucide-react';
import { exportToCSV } from '@/utils/exportUtils';
import ClientForm from '../components/admin/ClientForm';
import AdminLojaManager from '../components/admin/AdminLojaManager';
import WhatsappModal from '../components/crm/WhatsappModal';
import { toast } from 'sonner';
import { Loja } from '@/api/entities';
import { supabase } from '@/lib/supabase';

export default function GestaoClientes() {
  const [users, setUsers] = useState([]);
  const [lojasCountMap, setLojasCountMap] = useState({});
  // Lista completa das lojas (a contagem abaixo nao serve para a exportacao)
  const [lojas, setLojas] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipoNegocio, setFilterTipoNegocio] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [lojaManagerUser, setLojaManagerUser] = useState(null);
  const [lojasBloqueadasMap, setLojasBloqueadasMap] = useState({});

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Filtrar admins e fornecedores (fornecedores têm página própria em GestaoFornecedores)
    let filtered = users.filter(user =>
      user.role !== 'admin' && user.tipo_negocio !== 'fornecedor'
    );

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por tipo de negócio (multimarca ou franqueado)
    if (filterTipoNegocio !== 'all') {
      filtered = filtered.filter(user => user.tipo_negocio === filterTipoNegocio);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterTipoNegocio]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersList, lojasList] = await Promise.all([
        User.list(),
        Loja.list()
      ]);
      setUsers(usersList);
      setLojas(lojasList || []);

      // Build count map: user_id → number of lojas
      const countMap = {};
      const bloqueadasMap = {};
      (lojasList || []).forEach(l => {
        if (l.user_id) {
          countMap[l.user_id] = (countMap[l.user_id] || 0) + 1;
          if (l.bloqueada) {
            bloqueadasMap[l.user_id] = (bloqueadasMap[l.user_id] || 0) + 1;
          }
        }
      });
      setLojasCountMap(countMap);
      setLojasBloqueadasMap(bloqueadasMap);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  // Uma linha por LOJA (nao por cliente): a rede do franqueado tem varias, e e
  // a loja que tem CNPJ, codigo e endereco proprios. Segue o filtro da tela --
  // com "Franqueado" selecionado sai a relacao das franquias.
  const handleExportLojas = () => {
    const idsVisiveis = new Set(filteredUsers.map(u => u.id));
    const donoPorId = new Map(filteredUsers.map(u => [u.id, u]));

    const linhas = lojas
      .filter(l => idsVisiveis.has(l.user_id))
      .map(l => {
        const dono = donoPorId.get(l.user_id);
        return {
          rede: dono?.full_name || '',
          tipo: dono?.tipo_negocio === 'franqueado' ? 'Franqueado' : 'Multimarca',
          email_acesso: dono?.email || '',
          razao_social: l.nome || '',
          nome_fantasia: l.nome_fantasia || '',
          cnpj: l.cnpj || '',
          inscricao_estadual: l.inscricao_estadual || '',
          codigo_cliente: l.codigo_cliente || '',
          cidade: l.cidade || '',
          estado: l.estado || '',
          bairro: l.bairro || '',
          cep: l.cep || '',
          endereco: l.endereco_completo || '',
          telefone: l.telefone || '',
          whatsapp: l.whatsapp || '',
          email_loja: l.email || '',
          transportadora: l.transportadora_padrao || '',
          situacao: l.ativa ? 'Ativa' : 'Inativa',
          bloqueada: l.bloqueada ? 'Sim' : 'Não',
          motivo_bloqueio: l.motivo_bloqueio || ''
        };
      })
      .sort((a, b) => a.rede.localeCompare(b.rede, 'pt-BR') || a.razao_social.localeCompare(b.razao_social, 'pt-BR'));

    const columns = [
      { key: 'rede', label: 'Rede / Cliente' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'email_acesso', label: 'E-mail de Acesso' },
      { key: 'razao_social', label: 'Razão Social' },
      { key: 'nome_fantasia', label: 'Nome Fantasia' },
      { key: 'cnpj', label: 'CNPJ' },
      { key: 'inscricao_estadual', label: 'Inscrição Estadual' },
      { key: 'codigo_cliente', label: 'Código Cliente' },
      { key: 'cidade', label: 'Cidade' },
      { key: 'estado', label: 'UF' },
      { key: 'bairro', label: 'Bairro' },
      { key: 'cep', label: 'CEP' },
      { key: 'endereco', label: 'Endereço' },
      { key: 'telefone', label: 'Telefone' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'email_loja', label: 'E-mail da Loja' },
      { key: 'transportadora', label: 'Transportadora Padrão' },
      { key: 'situacao', label: 'Situação' },
      { key: 'bloqueada', label: 'Bloqueada' },
      { key: 'motivo_bloqueio', label: 'Motivo do Bloqueio' }
    ];

    const sufixo = filterTipoNegocio === 'all' ? 'todas' : filterTipoNegocio;
    exportToCSV(linhas, columns, `lojas-${sufixo}-${new Date().toISOString().split('T')[0]}.csv`);
    if (linhas.length > 0) {
      toast.success(`${linhas.length} loja(s) exportada(s)`);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleDelete = async (userId, userName) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      try {
        const { data, error } = await supabase.rpc('delete_user_complete', {
          target_user_id: userId
        });

        if (error) {
          console.error('Erro ao excluir usuário:', error);
          toast.error('Falha ao excluir o usuário. Tente novamente.');
          return;
        }

        if (data && !data.success) {
          toast.error(data.error || 'Falha ao excluir o usuário.');
          return;
        }

        toast.success('Usuário excluído com sucesso.');
        loadUsers();
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        toast.error('Falha ao excluir o usuário. Tente novamente.');
      }
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUsers(filteredUsers.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const getTipoNegocioColor = (tipo) => {
    const colors = {
      multimarca: 'bg-blue-100 text-blue-800',
      franqueado: 'bg-purple-100 text-purple-800',
      fornecedor: 'bg-green-100 text-green-800'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {showForm ? (
        <ClientForm
          user={editingUser}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(null);
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex gap-4 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterTipoNegocio} onValueChange={setFilterTipoNegocio}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Tipo de negócio" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="multimarca">Multimarca</SelectItem>
                  <SelectItem value="franqueado">Franqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleExportLojas} variant="outline" title="Uma linha por loja, seguindo o filtro acima">
                <Download className="w-4 h-4 mr-2" />
                Exportar Lojas
              </Button>
              <Button onClick={() => setShowWhatsappModal(true)} disabled={selectedUsers.length === 0} variant="outline" className="bg-green-50 hover:bg-green-100">
                <MessageSquare className="w-4 h-4 mr-2 text-green-600"/> Enviar WhatsApp
              </Button>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <span>Clientes Cadastrados ({filteredUsers.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Input type="checkbox" onChange={handleSelectAll} />
                    </TableHead>
                    <TableHead>Nome / Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Lojas</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleSelectUser(user.id)} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-gray-600">{user.empresa}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{user.email}</div>
                          <div className="text-sm text-gray-600">{user.telefone}</div>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={getTipoNegocioColor(user.tipo_negocio)}>{user.tipo_negocio}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {lojasCountMap[user.id] ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Store className="w-3 h-3 mr-1" />
                              {lojasCountMap[user.id]} {lojasCountMap[user.id] === 1 ? 'loja' : 'lojas'}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                          {lojasBloqueadasMap[user.id] > 0 && (
                            <Badge className="bg-red-100 text-red-700 text-[10px]">
                              {lojasBloqueadasMap[user.id]} bloq.
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><div className="text-sm">{user.cidade && user.estado ? `${user.cidade}/${user.estado}` : '-'}</div></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setLojaManagerUser(user)} title="Gerenciar Lojas">
                            <Store className="w-4 h-4 mr-1" />
                            Lojas
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id, user.full_name)}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {lojaManagerUser && (
        <AdminLojaManager
          open={!!lojaManagerUser}
          onOpenChange={(open) => { if (!open) setLojaManagerUser(null); }}
          userId={lojaManagerUser.id}
          userName={lojaManagerUser.full_name}
          onLojasChanged={loadUsers}
        />
      )}

      {showWhatsappModal && (
        <WhatsappModal
          contacts={users.filter(u => selectedUsers.includes(u.id)).map(u => ({...u, nome: u.full_name}))}
          onClose={() => setShowWhatsappModal(false)}
        />
      )}
    </div>
  );
}
