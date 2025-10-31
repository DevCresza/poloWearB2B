
import React, { useState, useEffect } from 'react';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, Edit, Star, Search, AlertTriangle, Eye, Trash2, Download } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency } from '@/utils/exportUtils';
import ProductForm from '../components/admin/ProductForm';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function GestaoProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');

  const categorias = [
    'Camisetas', 'Polos', 'Shorts', 'Calças', 
    'Vestidos', 'Blusas', 'Jaquetas', 'Acessórios'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();

      let produtosList, fornecedoresList;

      if (currentUser.tipo_negocio === 'fornecedor') {
        // Buscar fornecedor associado ao usuário
        const fornecedoresListTemp = await Fornecedor.filter({ responsavel_user_id: currentUser.id });
        const fornecedor = fornecedoresListTemp[0];

        if (fornecedor) {
          // Fornecedor vê apenas seus produtos
          produtosList = await Produto.filter({ fornecedor_id: fornecedor.id });
          fornecedoresList = [fornecedor];
        } else {
          produtosList = [];
          fornecedoresList = [];
        }
      } else {
        // Admin ou outros veem tudo
        produtosList = await Produto.list('-created_at');
        fornecedoresList = await Fornecedor.list();
      }

      setProdutos(produtosList || []);
      setFornecedores(fornecedoresList || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (produto) => {
    setEditingProduto(produto);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setEditingProduto(null);
    loadData();
  };
  
  const handleDestaqueToggle = async (produto, isChecked) => {
    try {
      await Produto.update(produto.id, { is_destaque: isChecked });
      loadData();
    } catch (error) {
      toast.error('Falha ao atualizar o status de destaque do produto.');
    }
  };

  const handleAtivoToggle = async (produto, isChecked) => {
    try {
      await Produto.update(produto.id, { ativo: isChecked });
      loadData();
    } catch (error) {
      toast.error('Falha ao atualizar o status do produto.');
    }
  };

  const handleDelete = async (produto) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await Produto.delete(produto.id);
      toast.success('Produto excluído com sucesso!');
      loadData();
    } catch (error) {
      toast.error('Falha ao excluir o produto. Verifique se não há pedidos vinculados.');
    }
  };

  const getFornecedorNome = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    return fornecedor ? (fornecedor.nome_fantasia || fornecedor.razao_social) : 'N/A';
  };

  const getStatusEstoque = (produto) => {
    if (!produto.controla_estoque) return null;

    if (produto.estoque_atual_grades <= 0) {
      return { label: 'Sem Estoque', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    }

    if (produto.estoque_atual_grades <= produto.estoque_minimo_grades) {
      return { label: 'Estoque Baixo', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    }

    return { label: 'Em Estoque', color: 'bg-green-100 text-green-800', icon: Package };
  };

  // Helper para parsear fotos do produto (vem como JSON string do banco)
  const getPrimeiraFoto = (produto) => {
    try {
      if (!produto.fotos) return null;
      const fotos = typeof produto.fotos === 'string' ? JSON.parse(produto.fotos) : produto.fotos;
      return fotos && fotos.length > 0 ? fotos[0] : null;
    } catch (e) {
      return null;
    }
  };

  // Helper para parsear tamanhos da grade (vem como JSON string do banco)
  const getTamanhosGrade = (produto) => {
    try {
      if (!produto.grade_configuracao) return 'N/A';
      const grade = typeof produto.grade_configuracao === 'string'
        ? JSON.parse(produto.grade_configuracao)
        : produto.grade_configuracao;
      return grade?.tamanhos_disponiveis?.join(', ') || 'N/A';
    } catch (e) {
      return 'N/A';
    }
  };

  // Filtrar produtos
  const filteredProdutos = produtos.filter(produto => {
    const matchesSearch = produto.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         produto.marca?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFornecedor = filterFornecedor === 'all' || produto.fornecedor_id === filterFornecedor;
    const matchesCategoria = filterCategoria === 'all' || produto.categoria === filterCategoria;
    
    return matchesSearch && matchesFornecedor && matchesCategoria;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <ProductForm
          produto={editingProduto}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingProduto(null);
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-6 h-6" />
                Gestão de Produtos
              </h1>
              <p className="text-gray-600">Cadastre e gerencie produtos com grades personalizadas</p>
            </div>
            
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filterFornecedor} onValueChange={setFilterFornecedor}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos fornecedores</SelectItem>
                    {fornecedores.map(fornecedor => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome_fantasia || fornecedor.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todas categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categorias.map(categoria => (
                      <SelectItem key={categoria} value={categoria}>
                        {categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Produtos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Produtos Cadastrados ({filteredProdutos.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.map((produto) => {
                      const statusEstoque = getStatusEstoque(produto);
                      
                      return (
                        <TableRow key={produto.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {getPrimeiraFoto(produto) ? (
                                <img
                                  src={getPrimeiraFoto(produto)}
                                  className="w-12 h-12 object-cover rounded-md"
                                  alt={produto.nome}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center">
                                  <Package className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {produto.nome}
                                  {produto.is_destaque && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                                </div>
                                <p className="text-xs text-gray-500">Polo Wear</p>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="secondary">
                              {getFornecedorNome(produto.fornecedor_id)}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            {produto.categoria && (
                              <Badge variant="outline">{produto.categoria}</Badge>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            {produto.tipo_venda === 'grade' && (
                              <div className="text-sm">
                                <div>{produto.total_pecas_grade} peças</div>
                                <div className="text-gray-500">
                                  {getTamanhosGrade(produto)}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm">
                              {produto.tipo_venda === 'grade' ? (
                                <>
                                  <div className="font-semibold">R$ {produto.preco_grade_completa?.toFixed(2)}</div>
                                  <div className="text-gray-500">R$ {produto.preco_por_peca?.toFixed(2)}/pç</div>
                                </>
                              ) : (
                                <div className="font-semibold">R$ {produto.preco_por_peca?.toFixed(2)}</div>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            {statusEstoque && (
                              <Badge className={statusEstoque.color}>
                                <statusEstoque.icon className="w-3 h-3 mr-1" />
                                {produto.estoque_atual_grades} grades
                              </Badge>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={produto.is_destaque}
                                onCheckedChange={(checked) => handleDestaqueToggle(produto, checked)}
                                aria-label="Destaque"
                                size="sm"
                              />
                              <span className="text-xs text-gray-500">Destaque</span>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              <Switch
                                checked={produto.ativo}
                                onCheckedChange={(checked) => handleAtivoToggle(produto, checked)}
                                aria-label="Ativo"
                                size="sm"
                              />
                              <span className="text-xs text-gray-500">Ativo</span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleEdit(produto)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleDelete(produto)}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {filteredProdutos.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                  <p className="text-gray-600">
                    {searchTerm || filterFornecedor !== 'all' || filterCategoria !== 'all' 
                      ? 'Tente ajustar os filtros de busca.' 
                      : 'Cadastre o primeiro produto do sistema.'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
