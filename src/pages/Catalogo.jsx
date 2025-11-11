
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Produto } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Capsula } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Search, ShoppingCart, Eye, Package, Calendar, Star, X,
  Plus, Minus, Check, AlertTriangle, Filter, SlidersHorizontal, Sparkles, Truck, Clock
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function Catalogo() {
  const [user, setUser] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [capsulas, setCapsulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFornecedor, setSelectedFornecedor] = useState('all');
  const [selectedCategoria, setSelectedCategoria] = useState('all');
  const [selectedDisponibilidade, setSelectedDisponibilidade] = useState('all');
  const [filtroEstoque, setFiltroEstoque] = useState('all');
  const [ordenacao, setOrdenacao] = useState('estoque_desc');
  const [selectedCapsula, setSelectedCapsula] = useState(null);
  const [selectedProduto, setSelectedProduto] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [carrinho, setCarrinho] = useState([]);
  const [quantidadeModal, setQuantidadeModal] = useState(1);
  const [selectedVariantColor, setSelectedVariantColor] = useState(null);
  const [adicionandoCarrinho, setAdicionandoCarrinho] = useState({});
  const [fotoAtualIndex, setFotoAtualIndex] = useState(0);

  useEffect(() => {
    checkUserAndLoadData();
    loadCarrinho();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      const [produtosList, fornecedoresList, capsulasList] = await Promise.all([
        Produto.list(),
        Fornecedor.list(),
        Capsula.list()
      ]);

      // Mostrar todos os produtos ativos (todas as marcas)
      const produtosAtivos = (produtosList || []).filter(p => p.ativo !== false);
      setProdutos(produtosAtivos);
      
      setFornecedores(fornecedoresList || []);
      capsulasList.forEach(capsula => {
        if (!capsula.produto_ids) {
          capsula.produto_ids = [];
        }
      });
      setCapsulas(capsulasList || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadCarrinho = () => {
    const carrinhoSalvo = localStorage.getItem('carrinho');
    if (carrinhoSalvo) {
      setCarrinho(JSON.parse(carrinhoSalvo));
    }
  };

  const salvarCarrinho = (novoCarrinho) => {
    setCarrinho(novoCarrinho);
    localStorage.setItem('carrinho', JSON.stringify(novoCarrinho));
  };

  const adicionarAoCarrinho = (produto, quantidade, corVariante = null) => {
    const itemExistente = carrinho.find(item => {
      if (corVariante) {
        return item.id === produto.id && item.cor_selecionada?.cor_nome === corVariante.cor_nome;
      }
      return item.id === produto.id && !item.cor_selecionada;
    });
    
    let novoCarrinho;
    if (itemExistente) {
      novoCarrinho = carrinho.map(item => {
        const matchKey = corVariante 
          ? item.id === produto.id && item.cor_selecionada?.cor_nome === corVariante.cor_nome
          : item.id === produto.id && !item.cor_selecionada;
        
        return matchKey
          ? { ...item, quantidade: item.quantidade + quantidade }
          : item;
      });
    } else {
      const itemCarrinho = { 
        ...produto, 
        quantidade,
        cor_selecionada: corVariante
      };
      novoCarrinho = [...carrinho, itemCarrinho];
    }
    
    salvarCarrinho(novoCarrinho);
    setShowDetailsModal(false);
  };

  const adicionarDiretoAoCarrinho = (produto) => {
    if (produto.tem_variantes_cor) {
      openProductDetails(produto);
      return;
    }

    setAdicionandoCarrinho(prev => ({ ...prev, [produto.id]: true }));
    
    const quantidade = produto.pedido_minimo_grades || 1;
    adicionarAoCarrinho(produto, quantidade);
    
    setTimeout(() => {
      setAdicionandoCarrinho(prev => ({ ...prev, [produto.id]: false }));
    }, 500);
  };

  const getProductTotalStock = (product) => {
    if (product.tem_variantes_cor) {
      try {
        const variantes = typeof product.variantes_cor === 'string'
          ? JSON.parse(product.variantes_cor)
          : product.variantes_cor;
        return variantes.reduce((sum, v) => sum + (v.estoque_grades || 0), 0);
      } catch (e) {
        return 0;
      }
    }
    return product.estoque_atual_grades || 0;
  };

  // Helper para parsear fotos do produto (vem como JSON string do banco)
  const getPrimeiraFoto = (produto) => {
    try {
      if (!produto.fotos) return null;
      const fotos = typeof produto.fotos === 'string' ? JSON.parse(produto.fotos) : produto.fotos;
      if (!fotos || fotos.length === 0) return null;

      // Suporta fotos como strings ou objetos com metadados
      const primeiraFoto = fotos[0];
      return typeof primeiraFoto === 'string' ? primeiraFoto : primeiraFoto?.url || null;
    } catch (e) {
      return null;
    }
  };

  const isLancamento = (produto) => {
    if (!produto.data_lancamento) return false;
    const dataLancamento = new Date(produto.data_lancamento);
    const diasDesde = (new Date() - dataLancamento) / (1000 * 60 * 60 * 24);
    return diasDesde <= 30; // Lançamento se tiver menos de 30 dias (30 dias como exemplo)
  };

  const filteredProducts = (produtos || []).filter(produto => {
    if (!produto.ativo) return false;

    // Só verifica estoque para produtos de pronta entrega
    if (produto.disponibilidade === 'pronta_entrega' && produto.controla_estoque && !produto.permite_venda_sem_estoque) {
      const estoqueTotal = getProductTotalStock(produto);
      if (estoqueTotal <= 0) return false;
    }

    const matchesSearch = produto.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (produto.descricao && produto.descricao.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (produto.referencia_fornecedor && produto.referencia_fornecedor.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (produto.referencia_polo && produto.referencia_polo.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFornecedor = selectedFornecedor === 'all' || produto.fornecedor_id === selectedFornecedor;
    const matchesCategoria = selectedCategoria === 'all' || produto.categoria === selectedCategoria;
    const matchesDisponibilidade = selectedDisponibilidade === 'all' || produto.disponibilidade === selectedDisponibilidade;
    const matchesCapsula = !selectedCapsula || selectedCapsula.produto_ids.includes(produto.id);

    // Filtro de estoque só se aplica a produtos de pronta entrega
    let matchesEstoque = true;
    if (produto.disponibilidade === 'pronta_entrega') {
      if (filtroEstoque === 'com_estoque') {
        matchesEstoque = getProductTotalStock(produto) > 0;
      } else if (filtroEstoque === 'baixo') {
        const estoque = getProductTotalStock(produto);
        matchesEstoque = estoque > 0 && estoque <= produto.estoque_minimo_grades;
      }
    }

    return matchesSearch && matchesFornecedor && matchesCategoria && matchesDisponibilidade && matchesCapsula && matchesEstoque;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const estoqueA = getProductTotalStock(a);
    const estoqueB = getProductTotalStock(b);
    
    switch (ordenacao) {
      case 'estoque_desc':
        if (estoqueA > 0 && estoqueB === 0) return -1;
        if (estoqueA === 0 && estoqueB > 0) return 1;
        return estoqueB - estoqueA;
      case 'estoque_asc':
        return estoqueA - estoqueB;
      case 'preco_asc':
        return a.preco_por_peca - b.preco_por_peca;
      case 'preco_desc':
        return b.preco_por_peca - a.preco_por_peca;
      case 'nome_asc':
        return a.nome.localeCompare(b.nome);
      case 'data_desc':
        return new Date(b.created_at) - new Date(a.created_at);
      default:
        return 0;
    }
  });

  const featuredProducts = produtos.filter(p => 
    p.is_destaque && 
    p.ativo && 
    (!p.controla_estoque || p.permite_venda_sem_estoque || getProductTotalStock(p) > 0)
  );
  
  const activeCapsulas = capsulas.filter(c => c.ativa);

  const getPricePerPiece = (produto) => {
    return produto.preco_por_peca;
  };
  
  const handleSelectCapsula = (capsula) => {
    setSelectedCapsula(capsula);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const clearCapsulaFilter = () => {
    setSelectedCapsula(null);
  };

  const openProductDetails = (produto) => {
    setSelectedProduto(produto);
    setQuantidadeModal(produto.pedido_minimo_grades || 1);
    setSelectedVariantColor(null);
    setFotoAtualIndex(0); // Reset foto para primeira
    setShowDetailsModal(true);
  };

  const categorias = ['Camisetas', 'Polos', 'Shorts', 'Calças', 'Vestidos', 'Blusas', 'Jaquetas', 'Acessórios'];

  const ProductCard = ({ produto }) => {
    let variantes = [];
    if (produto.tem_variantes_cor) {
      try {
        variantes = typeof produto.variantes_cor === 'string' 
          ? JSON.parse(produto.variantes_cor) 
          : produto.variantes_cor;
      } catch (e) {
        variantes = [];
      }
    }
    const estoque = getProductTotalStock(produto);
    const ehLancamento = isLancamento(produto);

    return (
      <Card className="hover:shadow-xl transition-all bg-white border-0 shadow-md group h-full flex flex-col">
        <div className="p-4 sm:p-5 flex flex-col h-full">
          <div
            className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden mb-4 relative cursor-pointer"
            onClick={() => openProductDetails(produto)}
          >
            {getPrimeiraFoto(produto) ? (
              <img
                src={getPrimeiraFoto(produto)}
                alt={produto.nome}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14" fill="%23999"%3ESem imagem%3C/text%3E%3C/svg%3E';
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="w-16 h-16 text-gray-300" />
              </div>
            )}
            
            {/* Badges no canto superior */}
            <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1.5">
              {produto.is_destaque && (
                <Badge className="bg-yellow-500 text-white shadow-lg text-[10px] sm:text-xs">
                  <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 fill-current" />
                  Destaque
                </Badge>
              )}
              {produto.disponibilidade === 'pronta_entrega' && (
                <Badge className="bg-green-500 text-white shadow-lg text-[10px] sm:text-xs">
                  <Truck className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                  Pronta Entrega
                </Badge>
              )}
              {produto.disponibilidade === 'pre_venda' && (
                <Badge className="bg-purple-500 text-white shadow-lg text-[10px] sm:text-xs">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                  Pré-Venda
                </Badge>
              )}
            </div>

            {/* Só mostra overlay "Sem Estoque" para produtos de pronta entrega */}
            {produto.disponibilidade === 'pronta_entrega' && produto.controla_estoque && estoque <= 0 && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                <Badge className="bg-red-600 text-white text-xs sm:text-sm font-semibold">Sem Estoque</Badge>
              </div>
            )}
          </div>
          
          <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col">
            <h3
              className="font-bold text-gray-900 line-clamp-2 text-sm sm:text-base lg:text-lg min-h-[2.5rem] sm:min-h-[3rem] cursor-pointer hover:text-blue-600 transition-colors"
              onClick={() => openProductDetails(produto)}
            >
              {produto.nome}
            </h3>
            
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] sm:text-xs">
                Polo Wear
              </Badge>
              <div className="text-right">
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                  R$ {produto.preco_por_peca?.toFixed(2)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">por peça</p>
              </div>
            </div>
            
            {produto.tipo_venda === 'grade' && (
              <p className="text-[10px] sm:text-xs text-gray-600 bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
                Grade: {produto.total_pecas_grade} peças • R$ {produto.preco_grade_completa?.toFixed(2)}
              </p>
            )}

            {/* Só mostra estoque para produtos de pronta entrega */}
            {produto.disponibilidade === 'pronta_entrega' && produto.controla_estoque && (
              <p className={`text-[10px] sm:text-xs font-semibold ${estoque > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {estoque > 0 ? `✓ ${estoque} disponível` : '✗ Esgotado'}
              </p>
            )}
            
            {produto.tem_variantes_cor && variantes.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {variantes.slice(0, 6).map((v, idx) => (
                  <div
                    key={idx}
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-gray-300 shadow-sm"
                    style={{ backgroundColor: v.cor_codigo_hex || v.cor_hex || '#000000' }}
                    title={
                      produto.disponibilidade === 'pronta_entrega'
                        ? `${v.cor_nome}: ${v.estoque_grades || 0} grades`
                        : v.cor_nome
                    }
                  />
                ))}
                {variantes.length > 6 && (
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-gray-300 bg-gray-100 flex items-center justify-center text-[8px] sm:text-[10px] text-gray-600 font-semibold">
                    +{variantes.length - 6}
                  </div>
                )}
              </div>
            )}

            {/* Badges de Lançamento e Disponibilidade abaixo das cores */}
            <div className="flex items-center gap-1.5">
              {ehLancamento && (
                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm text-[9px] px-1.5 py-0.5">
                  <Sparkles className="w-2 h-2 mr-0.5" />
                  Lançamento
                </Badge>
              )}
              {produto.disponibilidade === 'sob_encomenda' && (
                <Badge className="bg-orange-500 text-white shadow-sm text-[9px] px-1.5 py-0.5">
                  <Clock className="w-2 h-2 mr-0.5" />
                  Sob Encomenda
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2 pt-2 mt-auto">
              <Button
                onClick={() => adicionarDiretoAoCarrinho(produto)}
                disabled={
                  produto.disponibilidade === 'pronta_entrega' &&
                  produto.controla_estoque &&
                  !produto.permite_venda_sem_estoque &&
                  estoque <= 0
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-9 sm:h-11 text-xs sm:text-sm"
              >
                {adicionandoCarrinho[produto.id] ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <>
                    <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Adicionar</span>
                    <span className="sm:hidden">+</span>
                  </>
                )}
              </Button>
              <Button 
                onClick={() => openProductDetails(produto)}
                variant="outline"
                size="icon"
                className="h-9 w-9 sm:h-11 sm:w-11"
              >
                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Floating Cart Button */}
      {carrinho.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            onClick={() => window.location.href = '/Carrinho'}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-blue-600 hover:bg-blue-700 shadow-2xl relative"
          >
            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
            <Badge className="absolute -top-2 -right-2 bg-red-500 text-white h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center p-0 text-xs">
              {carrinho.length}
            </Badge>
          </Button>
        </div>
      )}

      {/* Header with Search and Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* Search Bar */}
          <div className="relative mb-3 sm:mb-4">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 sm:pl-12 h-10 sm:h-12 text-sm sm:text-base border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm"
            >
              <SlidersHorizontal className="w-3 h-3 sm:w-4 sm:h-4" />
              Filtros
            </Button>

            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="w-28 sm:w-40 h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-36 sm:w-48 h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estoque_desc">Maior Estoque</SelectItem>
                <SelectItem value="preco_asc">Menor Preço</SelectItem>
                <SelectItem value="preco_desc">Maior Preço</SelectItem>
                <SelectItem value="nome_asc">A-Z</SelectItem>
                <SelectItem value="data_desc">Novidades</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-xs sm:text-sm text-gray-600">
              {sortedProducts.length} produtos
            </div>
          </div>

          {/* Extended Filters */}
          {showFilters && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Fornecedores</SelectItem>
                  {fornecedores.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome_marca}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDisponibilidade} onValueChange={setSelectedDisponibilidade}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Disponibilidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pronta_entrega">Pronta Entrega</SelectItem>
                  <SelectItem value="pre_venda">Pré-Venda</SelectItem>
                  <SelectItem value="sob_encomenda">Sob Encomenda</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroEstoque} onValueChange={setFiltroEstoque}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Estoque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="com_estoque">Com Estoque</SelectItem>
                  <SelectItem value="baixo">Estoque Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Capsula Filter Alert */}
        {selectedCapsula && (
          <Alert className="border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-900 text-sm sm:text-base">
                  Cápsula: {selectedCapsula.nome}
                </span>
              </div>
              <Button onClick={clearCapsulaFilter} variant="ghost" size="sm">
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </Alert>
        )}

        {/* Featured Products */}
        {!selectedCapsula && featuredProducts.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 fill-yellow-500" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Produtos em Destaque</h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {featuredProducts.map(produto => (
                <ProductCard key={produto.id} produto={produto} />
              ))}
            </div>
          </div>
        )}

        {/* Capsules Section */}
        {!selectedCapsula && activeCapsulas.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Cápsulas Sugestivas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {activeCapsulas.map(capsula => (
                <div key={capsula.id} onClick={() => handleSelectCapsula(capsula)} className="cursor-pointer group">
                  <Card className="overflow-hidden hover:shadow-xl transition-all border-0 shadow-md">
                    <div className="aspect-video overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
                      {capsula.imagem_capa_url ? (
                        <img
                          src={capsula.imagem_capa_url}
                          alt={capsula.nome}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-16 h-16 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg></div>';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-16 h-16 text-purple-400" />
                        </div>
                      )}
                    </div>
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-xl">{capsula.nome}</CardTitle>
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{capsula.descricao}</p>
                      <Badge variant="outline" className="w-fit bg-purple-50 text-purple-700 border-purple-200 mt-2 text-xs">
                        {capsula.produto_ids?.length || 0} produtos
                      </Badge>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Products */}
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {selectedCapsula ? `Produtos da Cápsula: ${selectedCapsula.nome}` : 'Todos os Produtos'}
          </h2>
          
          {sortedProducts.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center border-0 shadow-md">
              <Package className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                Nenhum produto encontrado
              </h3>
              <p className="text-sm sm:text-base text-gray-600">
                Tente ajustar os filtros de busca.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {sortedProducts.map(produto => (
                <ProductCard key={produto.id} produto={produto} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduto && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{selectedProduto.nome}</DialogTitle>
            </DialogHeader>
            
            <div className="grid md:grid-cols-2 gap-6 py-4">
              {/* Images Gallery */}
              <div className="space-y-4">
                {(() => {
                  let fotosParaMostrar = [];
                  let fotosPrincipais = [];

                  // Sempre tentar pegar as fotos principais
                  try {
                    const fotos = typeof selectedProduto.fotos === 'string'
                      ? JSON.parse(selectedProduto.fotos)
                      : selectedProduto.fotos;
                    fotosPrincipais = Array.isArray(fotos) ? fotos : [];
                  } catch (e) {
                    fotosPrincipais = [];
                  }

                  if (selectedProduto.tem_variantes_cor && selectedVariantColor) {
                    // Tentar pegar fotos da variante
                    fotosParaMostrar = Array.isArray(selectedVariantColor.fotos_urls)
                      ? selectedVariantColor.fotos_urls
                      : [];

                    // Se a variante não tem fotos, usar as fotos principais
                    if (fotosParaMostrar.length === 0) {
                      fotosParaMostrar = fotosPrincipais;
                    }
                  } else {
                    fotosParaMostrar = fotosPrincipais;
                  }

                  // Extrair URLs (suporta strings e objetos com metadados)
                  const getFotoUrl = (foto) => typeof foto === 'string' ? foto : foto?.url || foto;

                  if (fotosParaMostrar.length > 0) {
                    return (
                      <>
                        {/* Foto Principal */}
                        <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                          <img
                            src={getFotoUrl(fotosParaMostrar[fotoAtualIndex] || fotosParaMostrar[0])}
                            alt={selectedProduto.nome}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Miniaturas - TODAS as fotos */}
                        {fotosParaMostrar.length > 1 && (
                          <div className="grid grid-cols-4 gap-2">
                            {fotosParaMostrar.map((foto, index) => (
                              <button
                                key={index}
                                onClick={() => setFotoAtualIndex(index)}
                                className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-all hover:border-blue-500 ${
                                  fotoAtualIndex === index ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent'
                                }`}
                              >
                                <img
                                  src={getFotoUrl(foto)}
                                  alt={`${selectedProduto.nome} ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  } else {
                    return (
                      <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                        <Package className="w-24 h-24 text-gray-300" />
                      </div>
                    );
                  }
                })()}
              </div>
              
              {/* Product Info */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge className="bg-blue-100 text-blue-800">Polo Wear</Badge>
                    {selectedProduto.categoria && (
                      <Badge variant="outline">{selectedProduto.categoria}</Badge>
                    )}
                    {selectedProduto.is_destaque && (
                      <Badge className="bg-yellow-500 text-white">
                        <Star className="w-3 h-3 mr-1 fill-current" />
                        Destaque
                      </Badge>
                    )}
                    {selectedProduto.disponibilidade === 'pre_venda' && (
                      <Badge className="bg-purple-100 text-purple-800">
                        <Calendar className="w-3 h-3 mr-1" />
                        Pré-Venda
                      </Badge>
                    )}
                    {selectedProduto.disponibilidade === 'sob_encomenda' && (
                      <Badge className="bg-orange-100 text-orange-800">
                        <Calendar className="w-3 h-3 mr-1" />
                        Sob Encomenda
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed">{selectedProduto.descricao}</p>

                  {(selectedProduto.referencia_fornecedor || selectedProduto.referencia_polo) && (
                    <div className="mt-3 text-sm text-gray-500 space-y-1">
                      {selectedProduto.referencia_fornecedor && (
                        <p>Ref. Fornecedor: {selectedProduto.referencia_fornecedor}</p>
                      )}
                      {selectedProduto.referencia_polo && (
                        <p>Ref. Polo: {selectedProduto.referencia_polo}</p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Price */}
                <div className="bg-blue-50 p-4 rounded-xl space-y-2 border border-blue-200">
                  <div className="text-sm text-gray-600 mb-1">Preço por Peça</div>
                  <div className="text-3xl font-bold text-blue-600">
                    R$ {selectedProduto.preco_por_peca?.toFixed(2)}
                  </div>
                  {selectedProduto.tipo_venda === 'grade' && (
                    <div className="pt-2 mt-2 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Grade completa ({selectedProduto.total_pecas_grade} peças):</span>
                        <span className="text-xl font-bold text-blue-700">
                          R$ {selectedProduto.preco_grade_completa?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Variantes de Cor */}
                {selectedProduto.tem_variantes_cor && (() => {
                  let variantes = [];
                  try {
                    variantes = typeof selectedProduto.variantes_cor === 'string' 
                      ? JSON.parse(selectedProduto.variantes_cor) 
                      : selectedProduto.variantes_cor;
                  } catch (e) {
                  }
                  
                  return variantes.length > 0 && (
                    <div>
                      <Label className="mb-3 block font-semibold">Selecione a Cor *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {variantes.map((v, idx) => {
                          const estoqueVariante = v.estoque_grades || 0;
                          const isSelected = selectedVariantColor?.cor_nome === v.cor_nome;
                          const semEstoque = estoqueVariante <= 0 && selectedProduto.controla_estoque && !selectedProduto.permite_venda_sem_estoque;

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!semEstoque) {
                                  setSelectedVariantColor(v);
                                  setFotoAtualIndex(0); // Reset foto ao trocar cor
                                }
                              }}
                              disabled={semEstoque}
                              className={`
                                flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                                ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}
                                ${semEstoque ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 cursor-pointer'}
                              `}
                            >
                              <div
                                className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: v.cor_codigo_hex || v.cor_hex || '#000000' }}
                              />
                              <div className="text-left flex-1">
                                <div className="font-medium text-sm">{v.cor_nome}</div>
                                <div className={`text-xs ${estoqueVariante > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {estoqueVariante > 0 ? `${estoqueVariante} grades` : 'Sem estoque'}
                                </div>
                              </div>
                              {isSelected && <Check className="w-5 h-5 text-blue-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Grade Info */}
                {selectedProduto.tipo_venda === 'grade' && selectedProduto.grade_configuracao && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold mb-3">Composição da Grade:</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProduto.grade_configuracao.tamanhos_disponiveis?.map(tamanho => (
                        <div key={tamanho} className="bg-white p-2 rounded-lg text-center border border-gray-200">
                          <div className="font-semibold">{tamanho}</div>
                          <div className="text-sm text-gray-600">
                            {selectedProduto.grade_configuracao.quantidades_por_tamanho[tamanho]} pç
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Stock */}
                {selectedProduto.controla_estoque && (
                  <div className="flex items-center gap-2">
                    {(() => {
                      let estoqueParaMostrar = 0;
                      if (selectedProduto.tem_variantes_cor && selectedVariantColor) {
                        estoqueParaMostrar = selectedVariantColor.estoque_grades || 0;
                      } else if (!selectedProduto.tem_variantes_cor) {
                        estoqueParaMostrar = selectedProduto.estoque_atual_grades || 0;
                      }

                      if (estoqueParaMostrar > 0) {
                        return (
                          <>
                            <Check className="w-5 h-5 text-green-600" />
                            <span className="text-green-600 font-medium">
                              {estoqueParaMostrar} grades disponíveis
                            </span>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <span className="text-red-600 font-medium">Sem estoque</span>
                          </>
                        );
                      }
                    })()}
                  </div>
                )}

                {/* Pré-Venda / Sob Encomenda Info */}
                {(selectedProduto.disponibilidade === 'pre_venda' || selectedProduto.disponibilidade === 'sob_encomenda') && (
                  <div className="bg-purple-50 p-4 rounded-xl space-y-2 text-sm border border-purple-200">
                    <h4 className="font-semibold text-purple-900">Informações de {selectedProduto.disponibilidade === 'pre_venda' ? 'Pré-Venda' : 'Sob Encomenda'}:</h4>
                    {selectedProduto.data_inicio_venda && (
                      <p className="text-purple-800">
                        <strong>Início das vendas:</strong> {new Date(selectedProduto.data_inicio_venda).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    {selectedProduto.data_limite_venda && (
                      <p className="text-purple-800">
                        <strong>Data limite:</strong> {new Date(selectedProduto.data_limite_venda).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    {selectedProduto.data_prevista_entrega && (
                      <p className="text-purple-800">
                        <strong>Entrega prevista:</strong> {new Date(selectedProduto.data_prevista_entrega).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Quantity Selector */}
                {(!selectedProduto.tem_variantes_cor || selectedVariantColor) && (
                  <div className="space-y-3">
                    <Label className="font-semibold">Quantidade de {selectedProduto.tipo_venda === 'grade' ? 'Grades' : 'Unidades'}:</Label>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantidadeModal(Math.max(selectedProduto.pedido_minimo_grades || 1, quantidadeModal - 1))}
                        className="h-10 w-10"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        min={selectedProduto.pedido_minimo_grades || 1}
                        value={quantidadeModal}
                        onChange={(e) => setQuantidadeModal(Math.max(selectedProduto.pedido_minimo_grades || 1, parseInt(e.target.value) || 1))}
                        className="w-20 text-center h-10"
                      />
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantidadeModal(quantidadeModal + 1)}
                        className="h-10 w-10"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      
                      <div className="text-sm text-gray-600">
                        {selectedProduto.pedido_minimo_grades && selectedProduto.pedido_minimo_grades > 1 && (
                          <div>Mínimo: {selectedProduto.pedido_minimo_grades}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-700">Total:</span>
                        <span className="text-3xl font-bold text-blue-600">
                          R$ {(getPricePerPiece(selectedProduto) * (selectedProduto.tipo_venda === 'grade' ? selectedProduto.total_pecas_grade : 1) * quantidadeModal).toFixed(2)}
                        </span>
                      </div>
                      {selectedProduto.tipo_venda === 'grade' && (
                        <div className="text-sm text-gray-600 mt-1">
                          {quantidadeModal * selectedProduto.total_pecas_grade} peças no total
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Add to Cart Button */}
                <Button
                  onClick={() => adicionarAoCarrinho(selectedProduto, quantidadeModal, selectedVariantColor)}
                  disabled={(() => {
                    // Desabilitar se tem variantes e não selecionou cor
                    if (selectedProduto.tem_variantes_cor && !selectedVariantColor) {
                      return true;
                    }

                    // Desabilitar se controla estoque e está sem estoque
                    if (selectedProduto.controla_estoque && !selectedProduto.permite_venda_sem_estoque) {
                      if (selectedProduto.tem_variantes_cor && selectedVariantColor) {
                        return (selectedVariantColor.estoque_grades || 0) <= 0;
                      } else if (!selectedProduto.tem_variantes_cor) {
                        return (selectedProduto.estoque_atual_grades || 0) <= 0;
                      }
                    }
                    return false;
                  })()}
                  className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {(() => {
                    // Mensagem se tem variantes e não selecionou cor
                    if (selectedProduto.tem_variantes_cor && !selectedVariantColor) {
                      return 'Selecione uma Cor';
                    }

                    // Mensagem se está sem estoque
                    if (selectedProduto.controla_estoque && !selectedProduto.permite_venda_sem_estoque) {
                      if (selectedProduto.tem_variantes_cor && selectedVariantColor) {
                        return (selectedVariantColor.estoque_grades || 0) <= 0 ? 'Produto Esgotado' : 'Adicionar ao Carrinho';
                      } else if (!selectedProduto.tem_variantes_cor) {
                        return (selectedProduto.estoque_atual_grades || 0) <= 0 ? 'Produto Esgotado' : 'Adicionar ao Carrinho';
                      }
                    }
                    return 'Adicionar ao Carrinho';
                  })()}
                </Button>

                {/* Alert quando não selecionou cor */}
                {selectedProduto.tem_variantes_cor && !selectedVariantColor && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      Por favor, selecione uma cor antes de adicionar ao carrinho.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
