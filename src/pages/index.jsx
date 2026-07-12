import Layout from "./Layout.jsx";

import Home from "./Home";
import UserManagement from "./UserManagement";
import PortalDashboard from "./PortalDashboard";
import PedidosAdmin from "./PedidosAdmin";
import CadastroCompra from "./CadastroCompra";
import Catalogo from "./Catalogo";
import MeusPedidos from "./MeusPedidos";
import Recursos from "./Recursos";
import Admin from "./Admin";
import GestaoProdutos from "./GestaoProdutos";
import GestaoFornecedores from "./GestaoFornecedores";
import CrmDashboard from "./CrmDashboard";
import GestaoClientes from "./GestaoClientes";
import GestaoCapsulas from "./GestaoCapsulas";
import EmissaoLote from "./EmissaoLote";
import GestaoEstoque from "./GestaoEstoque";
import Carrinho from "./Carrinho";
import PedidosFornecedor from "./PedidosFornecedor";
import DashboardAdmin from "./DashboardAdmin";
import GestaoMetas from "./GestaoMetas";
import HistoricoCompras from "./HistoricoCompras";
import CarteiraFinanceira from "./CarteiraFinanceira";
import ConfigWhatsApp from "./ConfigWhatsApp";
import MeuPerfil from "./MeuPerfil";
import Login from "./Login";
import ResetPassword from "./ResetPassword";
import HistoricoEmails from "./HistoricoEmails";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);

    return (
        <Layout currentPageName={currentPage}>
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
