
import { useState, useEffect } from 'react';
import { Fornecedor, Produto } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge'; // Added Badge import
import { Building, Plus, Trash2, AlertTriangle } from 'lucide-react';
import FornecedorForm from '../components/admin/FornecedorForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/exportUtils';

export default function GestaoFornecedores() {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] = useState(null);
  const [produtosVinculados, setProdutosVinculados] = useState([]);
  const [novoFornecedorId, setNovoFornecedorId] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    try {
      // Verificar se existem produtos vinculados a este fornecedor
      const produtos = await Produto.list({
        filters: { fornecedor_id: fornecedor.id }
      });

      if (produtos && produtos.length > 0) {
        // Abrir modal com opções
        setFornecedorToDelete(fornecedor);
        setProdutosVinculados(produtos);
        setShowDeleteModal(true);
        return;
      }

      // Se não houver produtos vinculados, pedir confirmação
      if (!confirm(`Tem certeza que deseja excluir o fornecedor "${fornecedor.nome_marca}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
      }

      await Fornecedor.delete(fornecedor.id);
      toast.success(`Fornecedor "${fornecedor.nome_marca}" excluído com sucesso!`);
      loadFornecedores();
    } catch (error) {
      toast.error(`Erro ao excluir fornecedor: ${error.message}`);
    }
  };

  const handleReatribuirProdutos = async () => {
    if (!novoFornecedorId) {
      toast.error('Selecione um fornecedor para reatribuir os produtos.');
      return;
    }

    setDeleting(true);
    try {
      // Reatribuir todos os produtos para o novo fornecedor
      for (const produto of produtosVinculados) {
        await Produto.update(produto.id, { fornecedor_id: novoFornecedorId });
      }

      // Agora excluir o fornecedor
      await Fornecedor.delete(fornecedorToDelete.id);

      toast.success(
        `Fornecedor "${fornecedorToDelete.nome_marca}" excluído!\n` +
        `${produtosVinculados.length} produto(s) foram reatribuído(s) ao novo fornecedor.`
      );

      setShowDeleteModal(false);
      setFornecedorToDelete(null);
      setProdutosVinculados([]);
      setNovoFornecedorId('');
      loadFornecedores();
    } catch (error) {
      toast.error(`Erro ao reatribuir produtos: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleExcluirProdutosEFornecedor = async () => {
    if (!confirm(
      `⚠️ ATENÇÃO: Esta ação é irreversível!\n\n` +
      `Você está prestes a excluir:\n` +
      `• ${produtosVinculados.length} produto(s)\n` +
      `• O fornecedor "${fornecedorToDelete.nome_marca}"\n\n` +
      `Tem certeza que deseja continuar?`
    )) {
      return;
    }

    setDeleting(true);
    try {
      // Excluir todos os produtos primeiro
      for (const produto of produtosVinculados) {
        await Produto.delete(produto.id);
      }

      // Agora excluir o fornecedor
      await Fornecedor.delete(fornecedorToDelete.id);

      toast.success(
        `Fornecedor "${fornecedorToDelete.nome_marca}" e ${produtosVinculados.length} produto(s) foram excluídos com sucesso.`
      );

      setShowDeleteModal(false);
      setFornecedorToDelete(null);
      setProdutosVinculados([]);
      setNovoFornecedorId('');
      loadFornecedores();
    } catch (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelarExclusao = () => {
    setShowDeleteModal(false);
    setFornecedorToDelete(null);
    setProdutosVinculados([]);
    setNovoFornecedorId('');
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
                    <TableHead>Pedido Mínimo</TableHead>
                    <TableHead>Email Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell className="font-medium">{fornecedor.nome_marca}</TableCell>
                      <TableCell>{fornecedor.razao_social}</TableCell>
                      <TableCell>{fornecedor.cnpj}</TableCell>
                      <TableCell>{formatCurrency(fornecedor.pedido_minimo_valor || 0)}</TableCell>
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

      {/* Modal de Exclusão com Produtos Vinculados */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              Fornecedor possui produtos vinculados
            </DialogTitle>
            <DialogDescription className="text-base mt-3">
              O fornecedor <strong>{fornecedorToDelete?.nome_marca}</strong> possui{' '}
              <strong>{produtosVinculados.length} produto(s)</strong> vinculado(s).
              <br />
              <br />
              Escolha como deseja proceder:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Opção 1: Reatribuir produtos */}
            <div className="space-y-3 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Reatribuir produtos para outro fornecedor
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Os produtos serão transferidos para outro fornecedor antes da exclusão.
                  </p>
                  <div className="space-y-2">
                    <Label>Selecione o novo fornecedor:</Label>
                    <Select value={novoFornecedorId} onValueChange={setNovoFornecedorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores
                          .filter(f => f.id !== fornecedorToDelete?.id)
                          .map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.razao_social || f.nome_fantasia || f.nome_marca}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Opção 2: Excluir tudo */}
            <div className="space-y-3 p-4 border-2 border-red-200 rounded-lg bg-red-50">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Excluir produtos e fornecedor
                  </h4>
                  <p className="text-sm text-gray-600">
                    ⚠️ <strong>ATENÇÃO:</strong> Esta ação excluirá permanentemente todos os {produtosVinculados.length} produto(s)
                    e o fornecedor. Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelarExclusao}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReatribuirProdutos}
              disabled={!novoFornecedorId || deleting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {deleting ? 'Processando...' : 'Reatribuir e Excluir Fornecedor'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleExcluirProdutosEFornecedor}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir Tudo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
