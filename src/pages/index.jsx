import Layout from "./Layout.jsx";

import { Suspense } from 'react';

// Home e Login ficam no bundle inicial: sao as portas de entrada e a imagem
// delas e o LCP. As demais 25 paginas viram um chunk cada (React.lazy) e so
// sao baixadas quando a rota abre. Antes tudo ia num chunk unico de 2,36 MB.
import Home from "./Home";
import Login from "./Login";
import { lazyComRecarga } from "@/utils/lazyComRecarga";
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

const UserManagement = lazyComRecarga(() => import("./UserManagement"));
const PortalDashboard = lazyComRecarga(() => import("./PortalDashboard"));
const PedidosAdmin = lazyComRecarga(() => import("./PedidosAdmin"));
const CadastroCompra = lazyComRecarga(() => import("./CadastroCompra"));
const Catalogo = lazyComRecarga(() => import("./Catalogo"));
const MeusPedidos = lazyComRecarga(() => import("./MeusPedidos"));
const Recursos = lazyComRecarga(() => import("./Recursos"));
const Admin = lazyComRecarga(() => import("./Admin"));
const GestaoProdutos = lazyComRecarga(() => import("./GestaoProdutos"));
const GestaoFornecedores = lazyComRecarga(() => import("./GestaoFornecedores"));
const CrmDashboard = lazyComRecarga(() => import("./CrmDashboard"));
const GestaoClientes = lazyComRecarga(() => import("./GestaoClientes"));
const GestaoCapsulas = lazyComRecarga(() => import("./GestaoCapsulas"));
const EmissaoLote = lazyComRecarga(() => import("./EmissaoLote"));
const GestaoEstoque = lazyComRecarga(() => import("./GestaoEstoque"));
const Carrinho = lazyComRecarga(() => import("./Carrinho"));
const PedidosFornecedor = lazyComRecarga(() => import("./PedidosFornecedor"));
const DashboardAdmin = lazyComRecarga(() => import("./DashboardAdmin"));
const GestaoMetas = lazyComRecarga(() => import("./GestaoMetas"));
const HistoricoCompras = lazyComRecarga(() => import("./HistoricoCompras"));
const CarteiraFinanceira = lazyComRecarga(() => import("./CarteiraFinanceira"));
const ConfigWhatsApp = lazyComRecarga(() => import("./ConfigWhatsApp"));
const MeuPerfil = lazyComRecarga(() => import("./MeuPerfil"));
const ResetPassword = lazyComRecarga(() => import("./ResetPassword"));
const HistoricoEmails = lazyComRecarga(() => import("./HistoricoEmails"));


const PAGES = {

    Home: Home,

    UserManagement: UserManagement,

    PortalDashboard: PortalDashboard,

    PedidosAdmin: PedidosAdmin,

    CadastroCompra: CadastroCompra,

    Catalogo: Catalogo,

    MeusPedidos: MeusPedidos,

    Recursos: Recursos,

    Admin: Admin,

    GestaoProdutos: GestaoProdutos,

    GestaoFornecedores: GestaoFornecedores,

    CrmDashboard: CrmDashboard,

    GestaoClientes: GestaoClientes,

    GestaoCapsulas: GestaoCapsulas,

    EmissaoLote: EmissaoLote,

    GestaoEstoque: GestaoEstoque,

    Carrinho: Carrinho,

    PedidosFornecedor: PedidosFornecedor,

    DashboardAdmin: DashboardAdmin,

    GestaoMetas: GestaoMetas,

    HistoricoCompras: HistoricoCompras,

    CarteiraFinanceira: CarteiraFinanceira,

    ConfigWhatsApp: ConfigWhatsApp,

    MeuPerfil: MeuPerfil,

    HistoricoEmails: HistoricoEmails,

    Login: Login,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Rota do portal: exige login e a permissao da pagina (src/utils/permissoes.js).
// Antes as rotas eram todas abertas e cada pagina se defendia sozinha — 7 delas
// nao se defendiam.
const protegida = (pagina, Componente) => (
    <ProtectedRoute pagina={pagina}>
        <Componente />
    </ProtectedRoute>
);

// Enquanto o chunk da pagina chega. Simples de proposito: sem layout que salte.
function CarregandoPagina() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-live="polite">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="sr-only">Carregando…</span>
        </div>
    );
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage}>
            <Suspense fallback={<CarregandoPagina />}>
            <Routes>

                {/* Publicas */}
                <Route path="/" element={<Home />} />
                <Route path="/Home" element={<Home />} />
                <Route path="/Login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/CadastroCompra" element={<CadastroCompra />} />

                {/* Portal (exigem login + permissao) */}
                <Route path="/PortalDashboard" element={protegida('PortalDashboard', PortalDashboard)} />
                <Route path="/MeuPerfil" element={protegida('MeuPerfil', MeuPerfil)} />
                <Route path="/Recursos" element={protegida('Recursos', Recursos)} />

                <Route path="/Catalogo" element={protegida('Catalogo', Catalogo)} />
                <Route path="/Carrinho" element={protegida('Carrinho', Carrinho)} />
                <Route path="/MeusPedidos" element={protegida('MeusPedidos', MeusPedidos)} />
                <Route path="/CarteiraFinanceira" element={protegida('CarteiraFinanceira', CarteiraFinanceira)} />
                <Route path="/HistoricoCompras" element={protegida('HistoricoCompras', HistoricoCompras)} />

                <Route path="/PedidosAdmin" element={protegida('PedidosAdmin', PedidosAdmin)} />
                <Route path="/PedidosFornecedor" element={protegida('PedidosFornecedor', PedidosFornecedor)} />
                <Route path="/EmissaoLote" element={protegida('EmissaoLote', EmissaoLote)} />
                <Route path="/HistoricoEmails" element={protegida('HistoricoEmails', HistoricoEmails)} />

                <Route path="/GestaoProdutos" element={protegida('GestaoProdutos', GestaoProdutos)} />
                <Route path="/GestaoCapsulas" element={protegida('GestaoCapsulas', GestaoCapsulas)} />
                <Route path="/GestaoEstoque" element={protegida('GestaoEstoque', GestaoEstoque)} />

                <Route path="/Admin" element={protegida('Admin', Admin)} />
                <Route path="/DashboardAdmin" element={protegida('DashboardAdmin', DashboardAdmin)} />
                <Route path="/UserManagement" element={protegida('UserManagement', UserManagement)} />
                <Route path="/GestaoClientes" element={protegida('GestaoClientes', GestaoClientes)} />
                <Route path="/GestaoFornecedores" element={protegida('GestaoFornecedores', GestaoFornecedores)} />
                <Route path="/CrmDashboard" element={protegida('CrmDashboard', CrmDashboard)} />
                <Route path="/GestaoMetas" element={protegida('GestaoMetas', GestaoMetas)} />
                <Route path="/ConfigWhatsApp" element={protegida('ConfigWhatsApp', ConfigWhatsApp)} />

            </Routes>
            </Suspense>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <AuthProvider>
                <PagesContent />
            </AuthProvider>
        </Router>
    );
}
