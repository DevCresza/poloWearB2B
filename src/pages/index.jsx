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

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    
    GestaoEstoque: GestaoEstoque,
    
    Carrinho: Carrinho,
    
    PedidosFornecedor: PedidosFornecedor,
    
    DashboardAdmin: DashboardAdmin,
    
    GestaoMetas: GestaoMetas,
    
    HistoricoCompras: HistoricoCompras,
    
    CarteiraFinanceira: CarteiraFinanceira,
    
    ConfigWhatsApp: ConfigWhatsApp,
    
    MeuPerfil: MeuPerfil,

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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/UserManagement" element={<UserManagement />} />
                
                <Route path="/PortalDashboard" element={<PortalDashboard />} />
                
                <Route path="/PedidosAdmin" element={<PedidosAdmin />} />
                
                <Route path="/CadastroCompra" element={<CadastroCompra />} />
                
                <Route path="/Catalogo" element={<Catalogo />} />
                
                <Route path="/MeusPedidos" element={<MeusPedidos />} />
                
                <Route path="/Recursos" element={<Recursos />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/GestaoProdutos" element={<GestaoProdutos />} />
                
                <Route path="/GestaoFornecedores" element={<GestaoFornecedores />} />
                
                <Route path="/CrmDashboard" element={<CrmDashboard />} />
                
                <Route path="/GestaoClientes" element={<GestaoClientes />} />
                
                <Route path="/GestaoCapsulas" element={<GestaoCapsulas />} />
                
                <Route path="/GestaoEstoque" element={<GestaoEstoque />} />
                
                <Route path="/Carrinho" element={<Carrinho />} />
                
                <Route path="/PedidosFornecedor" element={<PedidosFornecedor />} />
                
                <Route path="/DashboardAdmin" element={<DashboardAdmin />} />
                
                <Route path="/GestaoMetas" element={<GestaoMetas />} />
                
                <Route path="/HistoricoCompras" element={<HistoricoCompras />} />
                
                <Route path="/CarteiraFinanceira" element={<CarteiraFinanceira />} />
                
                <Route path="/ConfigWhatsApp" element={<ConfigWhatsApp />} />
                
                <Route path="/MeuPerfil" element={<MeuPerfil />} />

                <Route path="/Login" element={<Login />} />

                <Route path="/reset-password" element={<ResetPassword />} />

            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}