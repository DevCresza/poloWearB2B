
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, Plus, Edit, UserCheck, MessageSquare, Trash2 } from 'lucide-react';
import ClientForm from '../components/admin/ClientForm';
import WhatsappModal from '../components/crm/WhatsappModal';

export default function GestaoClientes() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipoNegocio, setFilterTipoNegocio] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let filtered = users.filter(user => user.role !== 'admin'); // Não mostrar admins
    
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nome_empresa?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // The filterTipoNegocio state will only contain 'all', 'multimarca', or 'fornecedor'
    // If a user has tipo_negocio 'franqueado', it will be filtered out when multimarca/fornecedor is selected.
    // When 'all' is selected, they will be included but display a default color.
    if (filterTipoNegocio !== 'all') {
      filtered = filtered.filter(user => user.tipo_negocio === filterTipoNegocio);
    }
    
    setFilteredUsers(filtered);
  }, [users, searchTerm, filterTipoNegocio]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersList = await User.list();
      setUsers(usersList);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
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
        await User.delete(userId);
        alert('Usuário excluído com sucesso.');
        loadUsers();
      } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        alert('Falha ao excluir o usuário. Tente novamente.');
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
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
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
                          <div className="text-sm text-gray-600">{user.nome_empresa}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{user.email}</div>
                          <div className="text-sm text-gray-600">{user.telefone}</div>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={getTipoNegocioColor(user.tipo_negocio)}>{user.tipo_negocio}</Badge></TableCell>
                      <TableCell><div className="text-sm">{user.cidade && user.estado ? `${user.cidade}/${user.estado}` : '-'}</div></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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

      {showWhatsappModal && (
        <WhatsappModal
          contacts={users.filter(u => selectedUsers.includes(u.id)).map(u => ({...u, nome: u.full_name}))}
          onClose={() => setShowWhatsappModal(false)}
        />
      )}
    </div>
  );
}
