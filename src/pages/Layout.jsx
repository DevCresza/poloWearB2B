

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { User } from '@/api/entities';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  LogOut,
  ShoppingCart,
  Package,
  Building,
  Settings,
  ClipboardList,
  UserPlus,
  TrendingUp,
  Image as ImageIcon,
  Users,
  Shield,
  Briefcase,
  DollarSign,
  Target,
  FileText,
  MessageCircle,
  BarChart3,
  BookOpen,
  Menu,
  X
} from 'lucide-react';
import AlertaBloqueio from '../components/AlertaBloqueio';
import Avatar from '@/components/Avatar';
import NotificacoesDropdown from '@/components/NotificacoesDropdown';

export default function Layout({ children, currentPageName }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
      } catch (_error) {
        setCurrentUser(null);
        // Redireciona para login se não autenticado e está tentando acessar página protegida
        const portalPages = [
          'PortalDashboard', 'UserManagement', 'Catalogo', 'MeusPedidos',
          'PedidosAdmin', 'Admin', 'GestaoProdutos', 'GestaoFornecedores',
          'CrmDashboard', 'GestaoClientes', 'GestaoCapsulas', 'GestaoEstoque',
          'Carrinho', 'PedidosFornecedor', 'CarteiraFinanceira', 'HistoricoCompras',
          'DashboardAdmin', 'GestaoMetas', 'Recursos', 'MeuPerfil'
        ];
        if (portalPages.includes(currentPageName)) {
          navigate('/Login');
        }
      }
    };
    checkUser();
    setMobileMenuOpen(false); // Fechar menu ao mudar de página
  }, [location.pathname, currentPageName, navigate]);

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair do sistema?')) {
      try {
        await User.logout();
        navigate('/Login');
      } catch (_error) {
        toast.info('Não foi possível sair do sistema. Tente novamente.');
      }
    }
  };

  const portalPages = [
    'PortalDashboard', 'UserManagement', 'Catalogo', 'MeusPedidos',
    'PedidosAdmin', 'Admin', 'GestaoProdutos', 'GestaoFornecedores',
    'CrmDashboard', 'GestaoClientes', 'GestaoCapsulas', 'GestaoEstoque',
    'Carrinho', 'PedidosFornecedor', 'CarteiraFinanceira', 'HistoricoCompras',
    'DashboardAdmin', 'GestaoMetas', 'Recursos', 'MeuPerfil' // Added 'MeuPerfil'
  ];
  const isPortalPage = portalPages.includes(currentPageName);

  if (!isPortalPage || !currentUser) {
    return <main className="bg-slate-100">{children}</main>;
  }

  const isAdmin = currentUser.role === 'admin';
  const isFornecedor = currentUser.tipo_negocio === 'fornecedor';
  const isCliente = currentUser.tipo_negocio === 'multimarca' || currentUser.tipo_negocio === 'franqueado';

  const isActiveLink = (pageName) => {
    const targetPath = createPageUrl(pageName);
    return location.pathname === targetPath;
  };

  const getNavLinkClasses = (pageName) => {
    const baseClasses = "flex items-center gap-3 px-4 py-3 rounded-lg transition-all";
    if (isActiveLink(pageName)) {
      return `${baseClasses} bg-blue-600 text-white shadow-lg font-semibold`;
    }
    return `${baseClasses} text-gray-700 hover:bg-white hover:shadow-md`;
  };

  const sectionTitleClasses = "px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase";

  const NavLinks = () => (
    <>
      {/* Link Comum */}
      <Link to={createPageUrl('PortalDashboard')} className={getNavLinkClasses('PortalDashboard')} onClick={() => setMobileMenuOpen(false)}>
        <LayoutDashboard className="w-5 h-5" />
        <span>Dashboard</span>
      </Link>

      {/* Meu Perfil - Link para todos */}
      <Link to={createPageUrl('MeuPerfil')} className={getNavLinkClasses('MeuPerfil')} onClick={() => setMobileMenuOpen(false)}>
        <UserPlus className="w-5 h-5" />
        <span>Meu Perfil</span>
      </Link>

      {/* Links do Cliente */}
      {(isCliente || isAdmin) && (
        <div>
          {isAdmin && <p className={sectionTitleClasses}>Área do Cliente</p>}
          <Link to={createPageUrl('Catalogo')} className={getNavLinkClasses('Catalogo')} onClick={() => setMobileMenuOpen(false)}>
            <ShoppingCart className="w-5 h-5" />
            <span>Catálogo</span>
          </Link>
          <Link to={createPageUrl('Carrinho')} className={getNavLinkClasses('Carrinho')} onClick={() => setMobileMenuOpen(false)}>
            <ShoppingCart className="w-5 h-5" />
            <span>Carrinho</span>
          </Link>
          <Link to={createPageUrl('MeusPedidos')} className={getNavLinkClasses('MeusPedidos')} onClick={() => setMobileMenuOpen(false)}>
            <Package className="w-5 h-5" />
            <span>Meus Pedidos</span>
          </Link>
          <Link to={createPageUrl('CarteiraFinanceira')} className={getNavLinkClasses('CarteiraFinanceira')} onClick={() => setMobileMenuOpen(false)}>
            <DollarSign className="w-5 h-5" />
            <span>Carteira</span>
          </Link>
          <Link to={createPageUrl('HistoricoCompras')} className={getNavLinkClasses('HistoricoCompras')} onClick={() => setMobileMenuOpen(false)}>
            <TrendingUp className="w-5 h-5" />
            <span>Histórico</span>
          </Link>
          <Link to={createPageUrl('Recursos')} className={getNavLinkClasses('Recursos')} onClick={() => setMobileMenuOpen(false)}>
            <BookOpen className="w-5 h-5" />
            <span>Conteúdos</span>
          </Link>
        </div>
      )}

      {/* Links do Fornecedor */}
      {(isFornecedor || isAdmin) && (
        <div>
          <p className={isAdmin ? sectionTitleClasses : "sr-only"}>Área do Fornecedor</p>
          <Link to={createPageUrl('GestaoProdutos')} className={getNavLinkClasses('GestaoProdutos')} onClick={() => setMobileMenuOpen(false)}>
            <ClipboardList className="w-5 h-5" />
            <span>{isAdmin ? 'Todos Produtos' : 'Meus Produtos'}</span>
          </Link>
          <Link to={createPageUrl('GestaoEstoque')} className={getNavLinkClasses('GestaoEstoque')} onClick={() => setMobileMenuOpen(false)}>
            <Package className="w-5 h-5" />
            <span>Gestão de Estoque</span>
          </Link>
          <Link to={createPageUrl('GestaoCapsulas')} className={getNavLinkClasses('GestaoCapsulas')} onClick={() => setMobileMenuOpen(false)}>
            <ImageIcon className="w-5 h-5" />
            <span>Cápsulas</span>
          </Link>
          <Link to={createPageUrl('PedidosFornecedor')} className={getNavLinkClasses('PedidosFornecedor')} onClick={() => setMobileMenuOpen(false)}>
            <Package className="w-5 h-5" />
            <span>{isAdmin ? 'Pedidos Fornecedores' : 'Meus Pedidos'}</span>
          </Link>
          <Link to={createPageUrl('CarteiraFinanceira')} className={getNavLinkClasses('CarteiraFinanceira')} onClick={() => setMobileMenuOpen(false)}>
            <DollarSign className="w-5 h-5" />
            <span>Carteira Financeira</span>
          </Link>
        </div>
      )}

      {/* Links de Administração */}
      {isAdmin && (
        <div>
          <p className={sectionTitleClasses}>Administração</p>
          <Link to={createPageUrl('Admin')} className={getNavLinkClasses('Admin')} onClick={() => setMobileMenuOpen(false)}>
            <Shield className="w-5 h-5" />
            <span>Painel Admin</span>
          </Link>
          <Link to={createPageUrl('DashboardAdmin')} className={getNavLinkClasses('DashboardAdmin')} onClick={() => setMobileMenuOpen(false)}>
            <BarChart3 className="w-5 h-5" />
            <span>Analytics</span>
          </Link>
          <Link to={createPageUrl('UserManagement')} className={getNavLinkClasses('UserManagement')} onClick={() => setMobileMenuOpen(false)}>
            <Users className="w-5 h-5" />
            <span>Gestão de Usuários</span>
          </Link>
          <Link to={createPageUrl('CrmDashboard')} className={getNavLinkClasses('CrmDashboard')} onClick={() => setMobileMenuOpen(false)}>
            <TrendingUp className="w-5 h-5" />
            <span>CRM & Leads</span>
          </Link>
          <Link to={createPageUrl('GestaoClientes')} className={getNavLinkClasses('GestaoClientes')} onClick={() => setMobileMenuOpen(false)}>
            <UserPlus className="w-5 h-5" />
            <span>Clientes</span>
          </Link>
          <Link to={createPageUrl('GestaoFornecedores')} className={getNavLinkClasses('GestaoFornecedores')} onClick={() => setMobileMenuOpen(false)}>
            <Building className="w-5 h-5" />
            <span>Fornecedores</span>
          </Link>
          <Link to={createPageUrl('PedidosAdmin')} className={getNavLinkClasses('PedidosAdmin')} onClick={() => setMobileMenuOpen(false)}>
            <Package className="w-5 h-5" />
            <span>Todos Pedidos</span>
          </Link>
          <Link to={createPageUrl('GestaoMetas')} className={getNavLinkClasses('GestaoMetas')} onClick={() => setMobileMenuOpen(false)}>
            <Target className="w-5 h-5" />
            <span>Metas</span>
          </Link>
          <Link to={createPageUrl('Recursos')} className={getNavLinkClasses('Recursos')} onClick={() => setMobileMenuOpen(false)}>
            <BookOpen className="w-5 h-5" />
            <span>Conteúdos</span>
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
        .shadow-neumorphic-inset { box-shadow: inset 5px 5px 10px #d1d9e6, inset -5px -5px 10px #ffffff; }
      `}</style>

      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="font-bold text-xl text-blue-600">POLO B2B</div>
          <div className="flex items-center gap-2">
            {/* Notificações Mobile */}
            <NotificacoesDropdown
              userId={currentUser.id}
              userRole={currentUser.role}
              userTipoNegocio={currentUser.tipo_negocio}
              userFornecedorId={currentUser.fornecedor_id}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 max-h-[calc(100vh-64px)] overflow-y-auto pb-4">
            <nav className="px-4 space-y-1">
              <NavLinks />
              <div className="pt-4">
                <Button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }} 
                  variant="ghost" 
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Sair
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-100 flex-col p-4">
        <div className="h-16 flex items-center justify-center font-bold text-2xl text-blue-600 mb-4">
          POLO B2B
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-4">
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg">
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-100 border-b border-gray-200 px-4 lg:px-8 py-4 sticky top-0 lg:top-auto z-40">
          <div className="flex items-center justify-between">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-800">
              {currentPageName.replace(/([A-Z])/g, ' $1').trim()}
            </h1>
            <div className="flex items-center gap-2 lg:gap-4">
              {/* Sino de Notificações */}
              <NotificacoesDropdown
                userId={currentUser.id}
                userRole={currentUser.role}
                userTipoNegocio={currentUser.tipo_negocio}
              />

              <span className="hidden sm:inline text-sm font-semibold text-gray-600">
                {currentUser.full_name}
              </span>
              <Avatar
                src={currentUser.avatar_url}
                name={currentUser.full_name}
                size="lg"
                onClick={() => navigate(createPageUrl('MeuPerfil'))}
                className="cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {isCliente && <AlertaBloqueio />}
          {children}
        </main>
      </div>
    </div>
  );
}

