
import React, { useState, useEffect } from 'react';
import { Fornecedor } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge'; // Added Badge import
import { Building, Plus, Trash2 } from 'lucide-react';
import FornecedorForm from '../components/admin/FornecedorForm';

export default function GestaoFornecedores() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);

  useEffect(() => {
    loadFornecedores();
  }, []);

  const loadFornecedores = async () => {
    setLoading(true);
    try {
      const fornecedoresList = await Fornecedor.list();
      setFornecedores(fornecedoresList);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (fornecedor) => {
    setEditingFornecedor(fornecedor);
    setShowForm(true);
  };
  
  const handleSuccess = () => {
    setShowForm(false);
    setEditingFornecedor(null);
    loadFornecedores();
  };

  const handleDelete = async (fornecedor) => {
    if (!confirm(`Tem certeza que deseja excluir o fornecedor "${fornecedor.nome_marca}"?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await Fornecedor.delete(fornecedor.id);
      toast.success(`Fornecedor "${fornecedor.nome_marca}" excluído com sucesso!`);
      loadFornecedores();
    } catch (error) {
      toast.error(`Erro ao excluir fornecedor: ${error.message}`);
    }
  };

  return (
     <div>
      {showForm ? (
        <FornecedorForm
          fornecedor={editingFornecedor}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingFornecedor(null);
          }}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              <span>Fornecedores</span>
            </CardTitle>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Fornecedor
            </Button>
          </CardHeader>
          <CardContent>
             {loading ? (
              <p>Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Marca</TableHead>
                    <TableHead>Razão Social</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Pedido Mínimo</TableHead> {/* Updated header */}
                    <TableHead>Email Acesso</TableHead> {/* New header */}
                    <TableHead>Status</TableHead> {/* New header */}
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell className="font-medium">{fornecedor.nome_marca}</TableCell>
                      <TableCell>{fornecedor.razao_social}</TableCell>
                      <TableCell>{fornecedor.cnpj}</TableCell>
                      <TableCell>R$ {fornecedor.pedido_minimo_valor?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell> {/* New cell for email and password */}
                        <div>
                          <div className="font-medium">{fornecedor.email_fornecedor || '-'}</div>
                          {fornecedor.email_fornecedor && (
                            <div className="text-xs text-gray-600">
                              {fornecedor.senha_fornecedor ? '••••••••' : 'Sem senha'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell> {/* New cell for status */}
                        <Badge className={fornecedor.ativo_fornecedor ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {fornecedor.ativo_fornecedor ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(fornecedor)}>
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(fornecedor)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
       )}
    </div>
  );
}
