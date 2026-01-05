
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
import { formatCurrency } from '@/utils/exportUtils';

export default function Catalogo() {
  const [user, setUser] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [todosProdutos, setTodosProdutos] = useState([]); // Lista completa sem filtros
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
  const [showCapsulaModal, setShowCapsulaModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [carrinho, setCarrinho] = useState([]);
  const [quantidadeModal, setQuantidadeModal] = useState(1);
  const [quantidadeCapsula, setQuantidadeCapsula] = useState(1);
  const [selectedVariantColor, setSelectedVariantColor] = useState(null);
  const [quantidadesPorCor, setQuantidadesPorCor] = useState({}); // { cor_id: quantidade }
  const [adicionandoCarrinho, setAdicionandoCarrinho] = useState({});
  const [fotoAtualIndex, setFotoAtualIndex] = useState(0);
  const [capsulaFotoIndex, setCapsulaFotoIndex] = useState(0); // Índice da foto atual na galeria da cápsula
  const [capsulaFotos, setCapsulaFotos] = useState([]); // Array de fotos para a galeria da cápsula

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

      // Guardar TODOS os produtos (incluindo inativos e visíveis apenas em cápsulas)
      // Isso permite que cápsulas mostrem produtos que foram desativados posteriormente
      setTodosProdutos(produtosList || []);

      // Mostrar apenas produtos ativos e que não sejam visíveis apenas em cápsulas no catálogo
      const produtosVisiveis = (produtosList || []).filter(p =>
        p.ativo !== false && p.visivel_apenas_capsulas !== true
      );
      setProdutos(produtosVisiveis);

      setFornecedores(fornecedoresList || []);

      // Parse produto_ids e produtos_quantidades de cada cápsula
      capsulasList.forEach(capsula => {
        // Parse produto_ids se vier como string
        if (capsula.produto_ids) {
          try {
            capsula.produto_ids = Array.isArray(capsula.produto_ids)
              ? capsula.produto_ids
              : JSON.parse(capsula.produto_ids);
          } catch (e) {
            capsula.produto_ids = [];
          }
        } else {
          capsula.produto_ids = [];
        }

        // Parse produtos_quantidades se vier como string
        if (capsula.produtos_quantidades) {
          try {
            capsula.produtos_quantidades = typeof capsula.produtos_quantidades === 'string'
              ? JSON.parse(capsula.produtos_quantidades)
              : capsula.produtos_quantidades;
          } catch (e) {
            capsula.produtos_quantidades = {};
          }
        } else {
          capsula.produtos_quantidades = {};
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

  // Função para adicionar múltiplas cores de uma vez (batch processing)
  const adicionarMultiplasCoresAoCarrinho = (produto, variantesComQuantidade) => {
    // Parse variantes
    let variantes = [];
    try {
      variantes = typeof produto.variantes_cor === 'string'
        ? JSON.parse(produto.variantes_cor)
        : produto.variantes_cor;
    } catch (e) {
      variantes = [];
    }

    // Acumular todos os itens que serão adicionados
    let novoCarrinho = [...carrinho];

    variantesComQuantidade.forEach(([varianteId, quantidade]) => {
      const variante = variantes.find(v => v.id === varianteId);
      if (!variante) return;

      // Verificar se já existe item com essa cor no carrinho
      const itemExistente = novoCarrinho.find(item =>
        item.id === produto.id && item.cor_selecionada?.cor_nome === variante.cor_nome
      );

      if (itemExistente) {
        // Incrementar quantidade do item existente
        novoCarrinho = novoCarrinho.map(item => {
          const matchKey = item.id === produto.id && item.cor_selecionada?.cor_nome === variante.cor_nome;
          return matchKey
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item;
        });
      } else {
        // Adicionar novo item
        const itemCarrinho = {
          ...produto,
          quantidade,
          cor_selecionada: variante
        };
        novoCarrinho.push(itemCarrinho);
      }
    });

    // Salvar carrinho UMA VEZ com todos os itens
    salvarCarrinho(novoCarrinho);

    const totalGrades = variantesComQuantidade.reduce((sum, [_, qtd]) => sum + qtd, 0);
    const mensagem = produto.tipo_venda === 'grade'
      ? `${totalGrades} Grade(s) adicionada(s) ao carrinho!`
      : `${variantesComQuantidade.length} cor(es) adicionada(s) ao carrinho!`;
    toast.success(mensagem);
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

  const adicionarCapsulaAoCarrinho = async () => {
    if (!selectedCapsula) return;

    try {
      // Parse produto_ids se necessário
      let produtoIds = [];
      try {
        produtoIds = Array.isArray(selectedCapsula.produto_ids)
          ? selectedCapsula.produto_ids
          : JSON.parse(selectedCapsula.produto_ids || '[]');
      } catch (e) {
        produtoIds = [];
      }

      // Parse produtos_quantidades
      let produtosQuantidades = {};
      try {
        produtosQuantidades = typeof selectedCapsula.produtos_quantidades === 'string'
          ? JSON.parse(selectedCapsula.produtos_quantidades)
          : selectedCapsula.produtos_quantidades || {};
      } catch (e) {
        produtosQuantidades = {};
      }

      // Calcular preço total da cápsula
      let precoTotalCapsula = 0;
      produtoIds.forEach(produtoId => {
        const produto = todosProdutos.find(p => p.id === produtoId);
        if (!produto) return;

        const qtdConfig = produtosQuantidades[produtoId];

        // Se tem variantes de cor configuradas
        if (qtdConfig && typeof qtdConfig === 'object' && qtdConfig.variantes) {
          qtdConfig.variantes.forEach(varianteConfig => {
            const quantidade = varianteConfig.quantidade || 0;
            const precoPorItem = produto.tipo_venda === 'grade'
              ? (produto.preco_grade_completa || 0)
              : (produto.preco_por_peca || 0);
            precoTotalCapsula += precoPorItem * quantidade;
          });
        } else if (typeof qtdConfig === 'number') {
          // Produto sem variantes
          const quantidade = qtdConfig;
          const precoPorItem = produto.tipo_venda === 'grade'
            ? (produto.preco_grade_completa || 0)
            : (produto.preco_por_peca || 0);
          precoTotalCapsula += precoPorItem * quantidade;
        }
      });

      // Verificar se já existe essa cápsula no carrinho
      const capsulaExistente = carrinho.find(item =>
        item.tipo === 'capsula' && item.capsula_id === selectedCapsula.id
      );

      let novoCarrinho;
      if (capsulaExistente) {
        // Se já existe, incrementar quantidade
        novoCarrinho = carrinho.map(item => {
          if (item.tipo === 'capsula' && item.capsula_id === selectedCapsula.id) {
            return { ...item, quantidade: item.quantidade + quantidadeCapsula };
          }
          return item;
        });
      } else {
        // Adicionar nova cápsula como item único
        const itemCapsula = {
          id: `capsula-${selectedCapsula.id}`, // ID único para a cápsula
          tipo: 'capsula', // Identificador de tipo
          capsula_id: selectedCapsula.id,
          nome: selectedCapsula.nome,
          descricao: selectedCapsula.descricao,
          imagem_capa_url: selectedCapsula.imagem_capa_url,
          quantidade: quantidadeCapsula,
          preco_total: precoTotalCapsula,
          preco_unitario: precoTotalCapsula, // Preço por cápsula
          produto_ids: produtoIds,
          produtos_quantidades: selectedCapsula.produtos_quantidades,
          // Informações adicionais para exibição
          detalhes_produtos: produtoIds.map(produtoId => {
            const produto = todosProdutos.find(p => p.id === produtoId);
            let produtosQuantidades = {};
            try {
              produtosQuantidades = typeof selectedCapsula.produtos_quantidades === 'string'
                ? JSON.parse(selectedCapsula.produtos_quantidades)
                : selectedCapsula.produtos_quantidades || {};
            } catch (e) {
              console.warn('Erro ao fazer parse de produtos_quantidades:', e);
            }

            const qtdConfig = produtosQuantidades[produtoId];

            // Enriquecer configuração com dados completos de cor (incluindo hex)
            let configEnriquecida = qtdConfig;
            if (qtdConfig && typeof qtdConfig === 'object' && qtdConfig.variantes && Array.isArray(qtdConfig.variantes)) {
              // Buscar variantes do produto para pegar cor_codigo_hex
              let variantesProduto = [];
              try {
                variantesProduto = typeof produto?.variantes_cor === 'string'
                  ? JSON.parse(produto.variantes_cor)
                  : produto?.variantes_cor || [];
              } catch (e) {
                variantesProduto = [];
              }

              // Adicionar cor_codigo_hex às variantes da configuração
              configEnriquecida = {
                ...qtdConfig,
                variantes: qtdConfig.variantes.map(varConfig => {
                  const varianteProduto = variantesProduto.find(v => v.id === varConfig.cor_id);
                  return {
                    ...varConfig,
                    cor_codigo_hex: varianteProduto?.cor_codigo_hex || varianteProduto?.cor_hex || '#000000'
                  };
                })
              };
            }

            return {
              id: produtoId,
              nome: produto?.nome || 'Produto não encontrado',
              foto: produto?.fotos?.[0] || null,
              configuracao: configEnriquecida
            };
          })
        };

        novoCarrinho = [...carrinho, itemCapsula];
      }

      salvarCarrinho(novoCarrinho);
      toast.success(`Cápsula "${selectedCapsula.nome}" (${quantidadeCapsula}x) adicionada ao carrinho!`);
      setShowCapsulaModal(false);
      setSelectedCapsula(null);
    } catch (error) {
      toast.error('Erro ao adicionar cápsula ao carrinho');
    }
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

    return matchesSearch && matchesFornecedor && matchesCategoria && matchesDisponibilidade && matchesEstoque;
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
    // Coletar todas as fotos das variantes dos produtos da cápsula
    const fotos = [];

    // Adicionar imagem de capa da cápsula primeiro (se existir)
    if (capsula.imagem_capa_url) {
      fotos.push({
        url: capsula.imagem_capa_url,
        tipo: 'capa',
        label: 'Capa da Cápsula'
      });
    }

    // Parse produto_ids e produtos_quantidades
    let produtoIds = [];
    let produtosQuantidades = {};
    try {
      produtoIds = Array.isArray(capsula.produto_ids)
        ? capsula.produto_ids
        : JSON.parse(capsula.produto_ids || '[]');
    } catch (e) {
      produtoIds = [];
    }
    try {
      produtosQuantidades = typeof capsula.produtos_quantidades === 'string'
        ? JSON.parse(capsula.produtos_quantidades)
        : capsula.produtos_quantidades || {};
    } catch (e) {
      produtosQuantidades = {};
    }

    // Para cada produto na cápsula, coletar fotos das variantes incluídas
    produtoIds.forEach(produtoId => {
      const produto = todosProdutos.find(p => p.id === produtoId);
      if (!produto) return;

      const qtdConfig = produtosQuantidades[produtoId];

      // Se tem variantes de cor configuradas
      if (qtdConfig && typeof qtdConfig === 'object' && qtdConfig.variantes) {
        // Buscar variantes do produto
        let variantesProduto = [];
        try {
          variantesProduto = typeof produto.variantes_cor === 'string'
            ? JSON.parse(produto.variantes_cor)
            : produto.variantes_cor || [];
        } catch (e) {
          variantesProduto = [];
        }

        // Parse fotos principais do produto (que têm cor associada)
        let fotosProduto = [];
        if (produto.fotos) {
          try {
            fotosProduto = typeof produto.fotos === 'string'
              ? JSON.parse(produto.fotos)
              : produto.fotos || [];
          } catch (e) {
            fotosProduto = [];
          }
        }

        // Para cada variante incluída na cápsula
        qtdConfig.variantes.forEach(varConfig => {
          const variante = variantesProduto.find(v => v.id === varConfig.cor_id);
          const corNome = varConfig.cor_nome || (variante ? variante.cor_nome : 'Cor');
          const corHex = varConfig.cor_hex || (variante ? variante.cor_codigo_hex || variante.cor_hex : '#000') || '#000';

          let fotoUrl = null;

          // 1. Primeiro tenta buscar nas fotos_urls da variante
          if (variante) {
            let fotosVariante = variante.fotos_urls || [];
            if (typeof fotosVariante === 'string') {
              try {
                fotosVariante = JSON.parse(fotosVariante);
              } catch (e) {
                fotosVariante = [];
              }
            }
            if (Array.isArray(fotosVariante) && fotosVariante.length > 0) {
              fotoUrl = fotosVariante[0];
            }
          }

          // 2. Se não encontrou, buscar nas fotos principais do produto pela cor
          if (!fotoUrl && fotosProduto.length > 0) {
            const fotoPorCor = fotosProduto.find(f =>
              f.cor_nome && f.cor_nome.toLowerCase() === corNome.toLowerCase()
            );
            if (fotoPorCor && fotoPorCor.url) {
              fotoUrl = fotoPorCor.url;
            }
          }

          // 3. Se ainda não encontrou, usar a primeira foto disponível
          if (!fotoUrl) {
            if (fotosProduto.length > 0 && fotosProduto[0].url) {
              fotoUrl = fotosProduto[0].url;
            } else {
              fotoUrl = getPrimeiraFoto(produto);
            }
          }

          if (fotoUrl) {
            fotos.push({
              url: fotoUrl,
              tipo: 'variante',
              produtoNome: produto.nome,
              corNome: corNome,
              corHex: corHex,
              quantidade: varConfig.quantidade,
              tipoVenda: produto.tipo_venda
            });
          }
        });
      } else if (typeof qtdConfig === 'number') {
        // Produto sem variantes - usar foto principal
        const fotoPrincipal = getPrimeiraFoto(produto);
        if (fotoPrincipal) {
          fotos.push({
            url: fotoPrincipal,
            tipo: 'produto',
            produtoNome: produto.nome,
            quantidade: qtdConfig,
            tipoVenda: produto.tipo_venda
          });
        }
      }
    });

    setCapsulaFotos(fotos);
    setCapsulaFotoIndex(0);
    setSelectedCapsula(capsula);
    setQuantidadeCapsula(1);
    setShowCapsulaModal(true);
  };

  const openProductDetails = (produto) => {
    setSelectedProduto(produto);
    setQuantidadeModal(produto.pedido_minimo_grades || 1);
    setSelectedVariantColor(null);
    setQuantidadesPorCor({}); // Reset quantidades por cor
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
                  {formatCurrency(produto.preco_por_peca)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500">por peça</p>
              </div>
            </div>
            
            {produto.tipo_venda === 'grade' && (
              <p className="text-[10px] sm:text-xs text-gray-600 bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
                Grade: {produto.total_pecas_grade} peças • {formatCurrency(produto.preco_grade_completa)}
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
                    <SelectItem key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia || f.nome_marca}</SelectItem>
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
        {/* Featured Products */}
        {featuredProducts.length > 0 && (
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
        {activeCapsulas.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Cápsulas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {activeCapsulas.map(capsula => (
                <div key={capsula.id} onClick={() => handleSelectCapsula(capsula)} className="cursor-pointer group">
                  <Card className="overflow-hidden hover:shadow-xl transition-all border-0 shadow-md">
                    <div className="aspect-[3/4] overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
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
            Todos os Produtos
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

                  // Extrair ID do YouTube
                  const getYouTubeVideoId = (url) => {
                    if (!url) return null;
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                    const match = url.match(regExp);
                    return (match && match[2].length === 11) ? match[2] : null;
                  };

                  const youtubeVideoId = getYouTubeVideoId(selectedProduto.video_url);
                  const totalMedias = fotosParaMostrar.length + (youtubeVideoId ? 1 : 0);

                  if (fotosParaMostrar.length > 0 || youtubeVideoId) {
                    return (
                      <>
                        {/* Foto/Vídeo Principal */}
                        <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
                          {fotoAtualIndex < fotosParaMostrar.length ? (
                            <img
                              src={getFotoUrl(fotosParaMostrar[fotoAtualIndex] || fotosParaMostrar[0])}
                              alt={selectedProduto.nome}
                              className="w-full h-full object-cover"
                            />
                          ) : youtubeVideoId ? (
                            <iframe
                              className="w-full h-full"
                              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                              title="Vídeo do Produto"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : null}
                        </div>

                        {/* Miniaturas - TODAS as fotos + vídeo */}
                        {totalMedias > 1 && (
                          <div className="grid grid-cols-4 gap-2">
                            {fotosParaMostrar.map((foto, index) => (
                              <button
                                key={`foto-${index}`}
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
                            {youtubeVideoId && (
                              <button
                                key="video"
                                onClick={() => setFotoAtualIndex(fotosParaMostrar.length)}
                                className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-all hover:border-blue-500 relative ${
                                  fotoAtualIndex === fotosParaMostrar.length ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent'
                                }`}
                              >
                                <img
                                  src={`https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`}
                                  alt="Vídeo do Produto"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </button>
                            )}
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
                    {formatCurrency(selectedProduto.preco_por_peca)}
                  </div>
                  {selectedProduto.tipo_venda === 'grade' && (
                    <div className="pt-2 mt-2 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-700">Grade completa ({selectedProduto.total_pecas_grade} peças):</span>
                        <span className="text-xl font-bold text-blue-700">
                          {formatCurrency(selectedProduto.preco_grade_completa)}
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
                  
                  // Se o produto é vendido em GRADE, permitir seleção de quantas grades quer de cada cor
                  if (selectedProduto.tipo_venda === 'grade') {
                    // Composição de Tamanhos da Grade (mostrar primeiro)
                    const gradeComposicao = (() => {
                      let gradeConfig = {};
                      try {
                        gradeConfig = typeof selectedProduto.grade_configuracao === 'string'
                          ? JSON.parse(selectedProduto.grade_configuracao)
                          : selectedProduto.grade_configuracao || {};
                      } catch (e) {
                        gradeConfig = {};
                      }

                      const tamanhos = gradeConfig.tamanhos_disponiveis || [];
                      const quantidades = gradeConfig.quantidades_por_tamanho || {};

                      if (tamanhos.length > 0) {
                        return (
                          <div className="mb-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <Label className="mb-3 block font-semibold text-blue-900">Composição da Grade:</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {tamanhos.map((tamanho, idx) => (
                                <div key={idx} className="bg-white rounded-lg p-2 border border-blue-200 text-center">
                                  <div className="text-sm font-bold text-gray-900">{tamanho}</div>
                                  <div className="text-xs text-gray-600">{quantidades[tamanho] || 0} peças</div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-blue-200 text-center">
                              <span className="text-sm font-semibold text-blue-900">
                                Total: {selectedProduto.total_pecas_grade || 0} peças por grade
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })();

                    return variantes.length > 0 && (
                      <div>
                        {gradeComposicao}

                        <Label className="mb-3 block font-semibold">Selecione Quantas Grades Quer de Cada Cor</Label>
                        <p className="text-sm text-gray-600 mb-3">
                          Escolha quantas grades completas deseja de cada cor. Cada grade contém a composição de tamanhos mostrada acima.
                        </p>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {variantes.map((v, idx) => {
                            const estoqueVariante = v.estoque_grades || 0;
                            const qtdSelecionada = quantidadesPorCor[v.id] || 0;
                            const semEstoque = selectedProduto.disponibilidade === 'pronta_entrega' &&
                                             estoqueVariante <= 0 &&
                                             selectedProduto.controla_estoque &&
                                             !selectedProduto.permite_venda_sem_estoque;

                            return (
                              <div
                                key={idx}
                                className={`
                                  flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                                  ${qtdSelecionada > 0 ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}
                                  ${semEstoque ? 'opacity-50' : ''}
                                `}
                              >
                                <div
                                  className="w-10 h-10 rounded-full border-2 border-gray-300 flex-shrink-0 cursor-pointer"
                                  style={{ backgroundColor: v.cor_codigo_hex || v.cor_hex || '#000000' }}
                                  onClick={() => {
                                    setSelectedVariantColor(v);
                                    setFotoAtualIndex(0);
                                  }}
                                  title="Clique para ver fotos desta cor"
                                />
                                <div className="text-left flex-1">
                                  <div className="font-medium text-sm">{v.cor_nome}</div>
                                  {!semEstoque && selectedProduto.controla_estoque && selectedProduto.disponibilidade === 'pronta_entrega' && (
                                    <div className="text-xs text-gray-500">
                                      {estoqueVariante} {estoqueVariante === 1 ? 'grade disponível' : 'grades disponíveis'}
                                    </div>
                                  )}
                                  {semEstoque && (
                                    <div className="text-xs text-red-500">Sem estoque</div>
                                  )}
                                </div>

                                {!semEstoque && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const novaQtd = Math.max(0, qtdSelecionada - 1);
                                        setQuantidadesPorCor(prev => ({ ...prev, [v.id]: novaQtd }));
                                      }}
                                      className="h-8 w-8"
                                      disabled={qtdSelecionada === 0}
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>

                                    <Input
                                      type="number"
                                      min="0"
                                      max={selectedProduto.controla_estoque && selectedProduto.disponibilidade === 'pronta_entrega' ? estoqueVariante : undefined}
                                      value={qtdSelecionada}
                                      onChange={(e) => {
                                        let valor = parseInt(e.target.value) || 0;
                                        if (selectedProduto.controla_estoque && selectedProduto.disponibilidade === 'pronta_entrega') {
                                          valor = Math.min(valor, estoqueVariante);
                                        }
                                        setQuantidadesPorCor(prev => ({ ...prev, [v.id]: Math.max(0, valor) }));
                                      }}
                                      className="w-16 text-center h-8 text-sm"
                                    />

                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        let novaQtd = qtdSelecionada + 1;
                                        if (selectedProduto.controla_estoque && selectedProduto.disponibilidade === 'pronta_entrega') {
                                          novaQtd = Math.min(novaQtd, estoqueVariante);
                                        }
                                        setQuantidadesPorCor(prev => ({ ...prev, [v.id]: novaQtd }));
                                      }}
                                      className="h-8 w-8"
                                      disabled={selectedProduto.controla_estoque && selectedProduto.disponibilidade === 'pronta_entrega' && qtdSelecionada >= estoqueVariante}
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // Se o produto é UNITÁRIO, permitir seleção individual por cor
                  return variantes.length > 0 && (
                    <div>
                      <Label className="mb-3 block font-semibold">Selecione as Quantidades por Cor</Label>
                      <p className="text-sm text-gray-600 mb-3">
                        Escolha a quantidade desejada de cada cor. Você pode adicionar múltiplas cores de uma vez.
                      </p>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {variantes.map((v, idx) => {
                          const estoqueVariante = v.estoque_grades || 0;
                          const qtdSelecionada = quantidadesPorCor[v.id] || 0;
                          const semEstoque = selectedProduto.disponibilidade === 'pronta_entrega' &&
                                           estoqueVariante <= 0 &&
                                           selectedProduto.controla_estoque &&
                                           !selectedProduto.permite_venda_sem_estoque;

                          return (
                            <div
                              key={idx}
                              className={`
                                flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                                ${qtdSelecionada > 0 ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}
                                ${semEstoque ? 'opacity-50' : ''}
                              `}
                            >
                              <div
                                className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0 cursor-pointer"
                                style={{ backgroundColor: v.cor_codigo_hex || v.cor_hex || '#000000' }}
                                onClick={() => {
                                  setSelectedVariantColor(v);
                                  setFotoAtualIndex(0);
                                }}
                                title="Clique para ver fotos desta cor"
                              />
                              <div className="text-left flex-1">
                                <div className="font-medium text-sm">{v.cor_nome}</div>
                                {selectedProduto.disponibilidade === 'pronta_entrega' && (
                                  <div className={`text-xs ${estoqueVariante > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {estoqueVariante > 0 ? `${estoqueVariante} em estoque` : 'Sem estoque'}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={semEstoque}
                                  onClick={() => {
                                    const novaQtd = Math.max(0, qtdSelecionada - 1);
                                    setQuantidadesPorCor(prev => ({
                                      ...prev,
                                      [v.id]: novaQtd
                                    }));
                                  }}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <span className="w-12 text-center font-semibold">
                                  {qtdSelecionada}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={semEstoque}
                                  onClick={() => {
                                    const novaQtd = qtdSelecionada + 1;
                                    setQuantidadesPorCor(prev => ({
                                      ...prev,
                                      [v.id]: novaQtd
                                    }));
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total de grades selecionadas */}
                      {Object.values(quantidadesPorCor).reduce((sum, qtd) => sum + qtd, 0) > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-900">Total:</span>
                            <span className="text-lg font-bold text-blue-600">
                              {Object.values(quantidadesPorCor).reduce((sum, qtd) => sum + qtd, 0)} {selectedProduto.tipo_venda === 'grade' ? 'grades' : 'unidades'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
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
                
                {/* Quantity Selector - Só para produtos sem variantes */}
                {!selectedProduto.tem_variantes_cor && (
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
                          {formatCurrency(getPricePerPiece(selectedProduto) * (selectedProduto.tipo_venda === 'grade' ? selectedProduto.total_pecas_grade : 1) * quantidadeModal)}
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
                  onClick={() => {
                    // Se produto tem variantes de cor (unitário ou grade), adiciona múltiplas cores com BATCH PROCESSING
                    if (selectedProduto.tem_variantes_cor) {
                      const variantesComQuantidade = Object.entries(quantidadesPorCor).filter(([_, qtd]) => qtd > 0);

                      if (variantesComQuantidade.length === 0) {
                        toast.info('Selecione pelo menos uma cor com quantidade maior que zero');
                        return;
                      }

                      // Usar função de batch processing
                      adicionarMultiplasCoresAoCarrinho(selectedProduto, variantesComQuantidade);
                    } else {
                      // Produto sem variantes, adiciona normalmente
                      adicionarAoCarrinho(selectedProduto, quantidadeModal, null);
                    }
                  }}
                  disabled={(() => {
                    // Se tem variantes de cor (unitário ou grade), verifica seleção
                    if (selectedProduto.tem_variantes_cor) {
                      const totalSelecionado = Object.values(quantidadesPorCor).reduce((sum, qtd) => sum + qtd, 0);
                      if (totalSelecionado === 0) {
                        return true;
                      }

                      // Verificar estoque se controla estoque e é pronta entrega
                      if (selectedProduto.controla_estoque &&
                          !selectedProduto.permite_venda_sem_estoque &&
                          selectedProduto.disponibilidade === 'pronta_entrega') {
                        let variantes = [];
                        try {
                          variantes = typeof selectedProduto.variantes_cor === 'string'
                            ? JSON.parse(selectedProduto.variantes_cor)
                            : selectedProduto.variantes_cor;
                        } catch (e) {
                          variantes = [];
                        }

                        // Verifica se alguma cor selecionada está sem estoque
                        const algumaSemEstoque = Object.entries(quantidadesPorCor).some(([varianteId, qtd]) => {
                          if (qtd > 0) {
                            const variante = variantes.find(v => v.id === varianteId);
                            return variante && (variante.estoque_grades || 0) <= 0;
                          }
                          return false;
                        });

                        if (algumaSemEstoque) {
                          return true;
                        }
                      }

                      return false;
                    }

                    // Produto sem variantes - lógica antiga
                    if (selectedProduto.controla_estoque &&
                        !selectedProduto.permite_venda_sem_estoque &&
                        selectedProduto.disponibilidade === 'pronta_entrega') {
                      return (selectedProduto.estoque_atual_grades || 0) <= 0;
                    }
                    return false;
                  })()}
                  className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {(() => {
                    // Produto com variantes de cor (unitário ou grade)
                    if (selectedProduto.tem_variantes_cor) {
                      const totalSelecionado = Object.values(quantidadesPorCor).reduce((sum, qtd) => sum + qtd, 0);

                      if (totalSelecionado === 0) {
                        return 'Selecione Quantidades';
                      }

                      // Verificar se alguma cor selecionada está sem estoque
                      if (selectedProduto.controla_estoque && !selectedProduto.permite_venda_sem_estoque) {
                        let variantes = [];
                        try {
                          variantes = typeof selectedProduto.variantes_cor === 'string'
                            ? JSON.parse(selectedProduto.variantes_cor)
                            : selectedProduto.variantes_cor;
                        } catch (e) {
                          variantes = [];
                        }

                        const algumaSemEstoque = Object.entries(quantidadesPorCor).some(([varianteId, qtd]) => {
                          if (qtd > 0) {
                            const variante = variantes.find(v => v.id === varianteId);
                            return variante && (variante.estoque_grades || 0) <= 0;
                          }
                          return false;
                        });

                        if (algumaSemEstoque) {
                          return 'Cor Selecionada Esgotada';
                        }
                      }

                      return `Adicionar ${totalSelecionado} ao Carrinho`;
                    }

                    // Produto sem variantes
                    if (selectedProduto.controla_estoque && !selectedProduto.permite_venda_sem_estoque) {
                      return (selectedProduto.estoque_atual_grades || 0) <= 0 ? 'Produto Esgotado' : 'Adicionar ao Carrinho';
                    }
                    return 'Adicionar ao Carrinho';
                  })()}
                </Button>

                {/* Alert quando não selecionou quantidades - apenas para produtos unitários */}
                {selectedProduto.tem_variantes_cor && selectedProduto.tipo_venda !== 'grade' && Object.values(quantidadesPorCor).reduce((sum, qtd) => sum + qtd, 0) === 0 && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      Por favor, selecione as quantidades desejadas para cada cor.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Detalhes da Cápsula */}
      {showCapsulaModal && selectedCapsula && (
        <Dialog open={showCapsulaModal} onOpenChange={setShowCapsulaModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <DialogTitle className="text-2xl">{selectedCapsula.nome}</DialogTitle>
              </div>
              <p className="text-gray-600 mt-2">{selectedCapsula.descricao}</p>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Galeria de fotos da cápsula */}
              {capsulaFotos.length > 0 && (
                <div className="space-y-4">
                  {/* Foto principal */}
                  <div className="relative w-full max-w-md mx-auto">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={capsulaFotos[capsulaFotoIndex]?.url}
                        alt={capsulaFotos[capsulaFotoIndex]?.produtoNome || selectedCapsula.nome}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Navegação esquerda/direita */}
                    {capsulaFotos.length > 1 && (
                      <>
                        <button
                          onClick={() => setCapsulaFotoIndex(prev => prev === 0 ? capsulaFotos.length - 1 : prev - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCapsulaFotoIndex(prev => prev === capsulaFotos.length - 1 ? 0 : prev + 1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}

                    {/* Info da foto atual */}
                    {capsulaFotos[capsulaFotoIndex]?.tipo !== 'capa' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <div className="flex items-center gap-2">
                          {capsulaFotos[capsulaFotoIndex]?.corHex && (
                            <div
                              className="w-5 h-5 rounded-full border-2 border-white shadow"
                              style={{ backgroundColor: capsulaFotos[capsulaFotoIndex].corHex }}
                            />
                          )}
                          <div className="text-white">
                            <p className="font-semibold text-sm">{capsulaFotos[capsulaFotoIndex]?.produtoNome}</p>
                            {capsulaFotos[capsulaFotoIndex]?.corNome && (
                              <p className="text-xs opacity-90">
                                {capsulaFotos[capsulaFotoIndex].corNome} - {capsulaFotos[capsulaFotoIndex].quantidade} {capsulaFotos[capsulaFotoIndex].tipoVenda === 'grade' ? 'grade(s)' : 'un.'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contador de fotos */}
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      {capsulaFotoIndex + 1} / {capsulaFotos.length}
                    </div>
                  </div>

                  {/* Miniaturas com bolinhas de cor */}
                  <div className="flex justify-center gap-2 flex-wrap max-w-md mx-auto">
                    {capsulaFotos.map((foto, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCapsulaFotoIndex(idx)}
                        className={`relative transition-all ${
                          capsulaFotoIndex === idx
                            ? 'ring-2 ring-purple-500 ring-offset-2'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {foto.tipo === 'capa' ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                            <img src={foto.url} alt="Capa" className="w-full h-full object-cover" />
                          </div>
                        ) : foto.corHex ? (
                          <div
                            className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm"
                            style={{ backgroundColor: foto.corHex }}
                            title={`${foto.produtoNome} - ${foto.corNome}`}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                            <img src={foto.url} alt={foto.produtoNome} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback se não tiver fotos mas tiver imagem de capa */}
              {capsulaFotos.length === 0 && selectedCapsula.imagem_capa_url && (
                <div className="w-full max-w-md mx-auto aspect-[3/4] rounded-lg overflow-hidden">
                  <img
                    src={selectedCapsula.imagem_capa_url}
                    alt={selectedCapsula.nome}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Composição da cápsula */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Composição da Cápsula:</h3>

                <div className="grid gap-4">
                  {(() => {
                    // Parse produto_ids se vier como string
                    let produtoIds = [];
                    try {
                      produtoIds = Array.isArray(selectedCapsula.produto_ids)
                        ? selectedCapsula.produto_ids
                        : JSON.parse(selectedCapsula.produto_ids || '[]');
                    } catch (e) {
                      produtoIds = [];
                    }
                    return produtoIds;
                  })().map((produtoId) => {
                    const produto = todosProdutos.find(p => p.id === produtoId);
                    if (!produto) return null;

                    let produtosQuantidades = {};
                    try {
                      produtosQuantidades = typeof selectedCapsula.produtos_quantidades === 'string'
                        ? JSON.parse(selectedCapsula.produtos_quantidades)
                        : selectedCapsula.produtos_quantidades || {};
                    } catch (e) {
                      produtosQuantidades = {};
                    }

                    const qtdConfig = produtosQuantidades[produtoId];
                    const primeiraFoto = getPrimeiraFoto(produto);

                    return (
                      <div key={produtoId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex gap-4">
                          {/* Foto do produto */}
                          <div className="w-20 h-20 rounded-md bg-gray-200 flex items-center justify-center flex-shrink-0">
                            {primeiraFoto ? (
                              <img
                                src={primeiraFoto}
                                alt={produto.nome}
                                className="w-full h-full rounded-md object-cover"
                              />
                            ) : (
                              <Package className="w-8 h-8 text-gray-400" />
                            )}
                          </div>

                          {/* Informações do produto */}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{produto.nome}</h4>
                            <p className="text-sm text-gray-600">{produto.marca}</p>

                            {/* Mostrar composição de cores se tiver variantes */}
                            {qtdConfig && typeof qtdConfig === 'object' && qtdConfig.variantes && qtdConfig.variantes.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-700">Cores incluídas:</p>
                                {qtdConfig.variantes.map((varianteConfig, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <div
                                      className="w-5 h-5 rounded-full border-2 border-gray-300"
                                      style={{ backgroundColor: varianteConfig.cor_hex || '#000' }}
                                    />
                                    <span className="font-medium">{varianteConfig.cor_nome}</span>
                                    <span className="text-gray-600">
                                      - {varianteConfig.quantidade} {produto.tipo_venda === 'grade' ? 'grade(s)' : 'unidade(s)'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Mostrar quantidade se produto sem variantes */}
                            {typeof qtdConfig === 'number' && (
                              <p className="mt-2 text-sm text-gray-600">
                                Quantidade: {qtdConfig} {produto.tipo_venda === 'grade' ? 'grade(s)' : 'unidade(s)'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cálculo do Valor da Cápsula */}
              {(() => {
                let valorTotalCapsula = 0;
                let produtosQuantidades = {};

                try {
                  produtosQuantidades = typeof selectedCapsula.produtos_quantidades === 'string'
                    ? JSON.parse(selectedCapsula.produtos_quantidades)
                    : selectedCapsula.produtos_quantidades || {};
                } catch (e) {
                  produtosQuantidades = {};
                }

                // Parse produto_ids se vier como string
                let produtoIds = [];
                try {
                  produtoIds = Array.isArray(selectedCapsula.produto_ids)
                    ? selectedCapsula.produto_ids
                    : JSON.parse(selectedCapsula.produto_ids || '[]');
                } catch (e) {
                  produtoIds = [];
                }

                // Calcular valor total da cápsula
                produtoIds.forEach((produtoId) => {
                  const produto = todosProdutos.find(p => p.id === produtoId);
                  if (!produto) return;

                  const qtdConfig = produtosQuantidades[produtoId];

                  // Se tem variantes de cor configuradas
                  if (qtdConfig && typeof qtdConfig === 'object' && qtdConfig.variantes) {
                    qtdConfig.variantes.forEach(varianteConfig => {
                      const quantidade = varianteConfig.quantidade || 0;
                      const precoPorItem = produto.tipo_venda === 'grade'
                        ? (produto.preco_grade_completa || 0)
                        : (produto.preco_por_peca || 0);
                      valorTotalCapsula += precoPorItem * quantidade;
                    });
                  } else if (typeof qtdConfig === 'number') {
                    // Produto sem variantes
                    const quantidade = qtdConfig;
                    const precoPorItem = produto.tipo_venda === 'grade'
                      ? (produto.preco_grade_completa || 0)
                      : (produto.preco_por_peca || 0);
                    valorTotalCapsula += precoPorItem * quantidade;
                  }
                });

                const valorComQuantidade = valorTotalCapsula * quantidadeCapsula;

                return (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-semibold text-gray-900">Valor unitário da cápsula:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(valorTotalCapsula)}
                      </span>
                    </div>
                    {quantidadeCapsula > 1 && (
                      <div className="flex justify-between items-center pt-2 border-t border-green-200">
                        <span className="text-base font-semibold text-gray-900">
                          Total ({quantidadeCapsula}x cápsulas):
                        </span>
                        <span className="text-3xl font-bold text-green-700">
                          {formatCurrency(valorComQuantidade)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Seletor de quantidade da cápsula */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <Label className="font-semibold text-gray-900 mb-3 block">
                  Quantas vezes deseja esta cápsula?
                </Label>
                <p className="text-sm text-gray-600 mb-3">
                  Ao selecionar 2x, você receberá o dobro de cada item acima. 3x triplica, e assim por diante.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setQuantidadeCapsula(Math.max(1, quantidadeCapsula - 1))}
                    className="h-12 w-12"
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className="text-3xl font-bold text-blue-600">{quantidadeCapsula}x</span>
                    <p className="text-xs text-gray-600 mt-1">da cápsula completa</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setQuantidadeCapsula(quantidadeCapsula + 1)}
                    className="h-12 w-12"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Botão adicionar ao carrinho */}
              <Button
                onClick={adicionarCapsulaAoCarrinho}
                className="w-full h-14 text-lg bg-purple-600 hover:bg-purple-700"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Adicionar Cápsula ao Carrinho
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
