import { useState, useEffect, useRef } from 'react';
import { Recurso } from '@/api/entities';
import { User } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  FileText, Video, Image as ImageIcon, CheckSquare, TrendingUp,
  Search, Play, Star, ChevronLeft, ChevronRight, Eye, Plus
} from 'lucide-react';
import RecursoDetailsModal from '../components/recursos/RecursoDetailsModal';
import RecursoForm from '../components/recursos/RecursoForm';

export default function Recursos() {
  const [recursos, setRecursos] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecurso, setSelectedRecurso] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      let recursosList = [];
      if (currentUser.role === 'admin') {
        recursosList = await Recurso.list('-created_at');
      } else {
        const allRecursos = await Recurso.filter({ ativo: true }, '-created_at');
        recursosList = allRecursos.filter(r => {
          if (r.disponivel_para === 'todos') return true;
          if (r.disponivel_para === 'ambos' && 
              (currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'fornecedor')) {
            return true;
          }
          if (r.disponivel_para === 'multimarcas' && currentUser.tipo_negocio === 'multimarca') {
            return true;
          }
          if (r.disponivel_para === 'fornecedores' && currentUser.tipo_negocio === 'fornecedor') {
            return true;
          }
          return false;
        });
      }

      setRecursos(recursosList || []);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const handleViewRecurso = async (recurso) => {
    try {
      await Recurso.update(recurso.id, {
        visualizacoes: (recurso.visualizacoes || 0) + 1
      });
    } catch (_error) {
    }

    setSelectedRecurso(recurso);
    setShowDetailsModal(true);
  };

  const getTipoIcon = (tipo) => {
    const icons = {
      artigo: FileText,
      video: Video,
      lookbook: ImageIcon,
      checklist: CheckSquare,
      marketing: TrendingUp,
      imagem: ImageIcon
    };
    return icons[tipo] || FileText;
  };

  const filteredRecursos = recursos.filter(recurso => {
    if (!searchTerm) return true;
    return recurso.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           recurso.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const recursosDestaque = filteredRecursos.filter(r => r.is_destaque);
  const recursoHero = recursosDestaque[0] || filteredRecursos[0];

  const agruparPorCategoria = () => {
    const grupos = {
      treinamento: [],
      marketing: [],
      produto: [],
      capsula: [],
      vendas: [],
      operacional: []
    };

    filteredRecursos.forEach(recurso => {
      if (grupos[recurso.categoria]) {
        grupos[recurso.categoria].push(recurso);
      }
    });

    return grupos;
  };

  const categoriasComRecursos = agruparPorCategoria();

  const getCategoriaLabel = (categoria) => {
    const labels = {
      treinamento: 'Treinamentos',
      marketing: 'Marketing',
      produto: 'Produtos',
      capsula: 'Cápsulas',
      vendas: 'Vendas',
      operacional: 'Operacional'
    };
    return labels[categoria] || categoria;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <style>{`
        .netflix-card {
          transition: all 0.3s ease;
        }
        .netflix-card:hover {
          transform: scale(1.05);
          z-index: 10;
        }
        .hero-gradient {
          background: linear-gradient(to right, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%);
        }
        .category-row {
          scroll-behavior: smooth;
        }
        .category-row::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-black to-transparent">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-3xl font-bold text-red-600">POLO</h1>
            <nav className="hidden md:flex gap-6">
              <span className="text-sm hover:text-gray-300 cursor-pointer transition">Início</span>
              <span className="text-sm font-semibold text-white cursor-pointer">Central de Conteúdo</span>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar conteúdo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 w-64"
              />
            </div>

            {user?.role === 'admin' && (
              <Button 
                onClick={() => setShowForm(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Conteúdo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      {recursoHero && (
        <div className="relative h-[80vh] -mt-20">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${recursoHero.thumbnail_url || 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=1920'})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 hero-gradient" />
          
          <div className="absolute bottom-0 left-0 right-0 p-12">
            <div className="container mx-auto max-w-2xl">
              {recursoHero.is_destaque && (
                <Badge className="bg-red-600 text-white mb-4 px-3 py-1">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Em Destaque
                </Badge>
              )}
              
              <h2 className="text-5xl md:text-7xl font-bold mb-4">
                {recursoHero.titulo}
              </h2>
              
              <p className="text-lg md:text-xl text-gray-300 mb-6 line-clamp-3">
                {recursoHero.descricao}
              </p>
              
              <div className="flex items-center gap-4 mb-6">
                <Badge variant="outline" className="text-green-400 border-green-400">
                  {recursoHero.tipo === 'video' ? 'Vídeo' : 
                   recursoHero.tipo === 'artigo' ? 'Artigo' : 
                   recursoHero.tipo}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Eye className="w-4 h-4" />
                  {recursoHero.visualizacoes || 0} visualizações
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => handleViewRecurso(recursoHero)}
                  className="bg-white text-black hover:bg-gray-200 px-8 py-6 text-lg font-semibold"
                >
                  <Play className="w-5 h-5 mr-2 fill-current" />
                  Assistir Agora
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Search */}
      <div className="md:hidden px-6 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar conteúdo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-black/50 border-gray-700 text-white placeholder:text-gray-500 w-full"
          />
        </div>
      </div>

      {/* Content Rows */}
      <div className="py-8 space-y-12">
        {/* Destaques */}
        {recursosDestaque.length > 1 && (
          <ContentRow
            title="Em Destaque"
            recursos={recursosDestaque}
            onSelect={handleViewRecurso}
            getTipoIcon={getTipoIcon}
          />
        )}

        {/* Categorias */}
        {Object.entries(categoriasComRecursos).map(([categoria, recursos]) => {
          if (recursos.length === 0) return null;
          
          return (
            <ContentRow
              key={categoria}
              title={getCategoriaLabel(categoria)}
              recursos={recursos}
              onSelect={handleViewRecurso}
              getTipoIcon={getTipoIcon}
            />
          );
        })}

        {filteredRecursos.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-20 h-20 text-gray-600 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-gray-400 mb-3">
              Nenhum conteúdo encontrado
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'Tente buscar por outro termo.' 
                : 'Novos conteúdos serão adicionados em breve.'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showDetailsModal && selectedRecurso && (
        <RecursoDetailsModal
          recurso={selectedRecurso}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRecurso(null);
          }}
          isAdmin={user?.role === 'admin'}
          onEdit={() => {
            setShowDetailsModal(false);
            setShowForm(true);
          }}
          onDelete={() => {
            setShowDetailsModal(false);
            setSelectedRecurso(null);
            loadData();
          }}
        />
      )}

      {showForm && (
        <RecursoForm
          recurso={selectedRecurso}
          onClose={() => {
            setShowForm(false);
            setSelectedRecurso(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setSelectedRecurso(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function ContentRow({ title, recursos, onSelect, getTipoIcon }) {
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="relative group px-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 z-20 bg-black/80 hover:bg-black text-white p-2 rounded-r opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto category-row pb-4"
      >
        {recursos.map((recurso) => {
          const TipoIcon = getTipoIcon(recurso.tipo);
          
          return (
            <Card
              key={recurso.id}
              className="netflix-card flex-shrink-0 w-72 bg-gray-900 border-0 cursor-pointer overflow-hidden"
              onClick={() => onSelect(recurso)}
            >
              <div className="relative aspect-video bg-gray-800">
                {recurso.thumbnail_url ? (
                  <img 
                    src={recurso.thumbnail_url} 
                    alt={recurso.titulo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <TipoIcon className="w-16 h-16 text-gray-600" />
                  </div>
                )}
                
                {recurso.tipo === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                    <Play className="w-16 h-16 text-white fill-current" />
                  </div>
                )}

                {recurso.is_destaque && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-red-600 text-white">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      Destaque
                    </Badge>
                  </div>
                )}
              </div>
              
              <CardContent className="p-4">
                <h3 className="font-semibold text-white mb-2 line-clamp-2 text-lg">
                  {recurso.titulo}
                </h3>
                
                <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                  {recurso.descricao}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <TipoIcon className="w-4 h-4" />
                    <span className="capitalize">{recurso.tipo}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{recurso.visualizacoes || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 z-20 bg-black/80 hover:bg-black text-white p-2 rounded-l opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}