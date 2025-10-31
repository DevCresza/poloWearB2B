import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, Package, Building, ClipboardList, Activity, UserPlus, Settings, TrendingUp, Image as ImageIcon, Eye } from 'lucide-react';
import AdminViewSelector from '../components/admin/AdminViewSelector';

export default function Admin() {
  const [currentView, setCurrentView] = useState('admin');

  const getCardsForView = () => {
    const allCards = [
      { title: "CRM & Gestão de Leads", icon: TrendingUp, description: "Acompanhe leads do formulário até a conversão.", link: "CrmDashboard", color: "text-blue-600", views: ['admin'] },
      { title: "Gestão de Clientes", icon: UserPlus, description: "Cadastre e gerencie clientes e suas permissões.", link: "GestaoClientes", color: "text-green-600", views: ['admin'] },
      { title: "Gestão de Usuários", icon: Users, description: "Gerencie usuários pendentes e convites.", link: "UserManagement", color: "text-purple-600", views: ['admin'] },
      { title: "Gestão de Produtos", icon: ClipboardList, description: "Adicione, edite e gerencie todos os produtos.", link: "GestaoProdutos", color: "text-purple-600", views: ['admin', 'fornecedor'] },
      { title: "Gestão de Cápsulas", icon: ImageIcon, description: "Crie coleções de produtos para o catálogo.", link: "GestaoCapsulas", color: "text-pink-600", views: ['admin', 'fornecedor'] },
      { title: "Gestão de Fornecedores", icon: Building, description: "Defina regras como valores mínimos de pedido.", link: "GestaoFornecedores", color: "text-orange-600", views: ['admin'] },
      { title: "Gestão de Pedidos", icon: Package, description: "Acompanhe e gerencie todos os pedidos.", link: "PedidosAdmin", color: "text-indigo-600", views: ['admin', 'fornecedor'] },
      { title: "Catálogo de Produtos", icon: ClipboardList, description: "Veja produtos disponíveis para compra.", link: "Catalogo", color: "text-blue-600", views: ['cliente'] },
      { title: "Meus Pedidos", icon: Package, description: "Acompanhe seus pedidos realizados.", link: "MeusPedidos", color: "text-green-600", views: ['cliente'] },
      { title: "Configurações", icon: Settings, description: "Configurações gerais do sistema e permissões.", link: null, color: "text-gray-600", views: ['admin'] },
    ];

    return allCards.filter(card => card.views.includes(currentView));
  };

  const getViewTitle = () => {
    const titles = {
      admin: 'Painel de Administração Completo',
      cliente: 'Visão do Cliente/Multimarca',
      fornecedor: 'Visão do Fornecedor'
    };
    return titles[currentView];
  };

  const getViewDescription = () => {
    const descriptions = {
      admin: 'Gerencie todos os aspectos do seu sistema B2B com acesso completo.',
      cliente: 'Experiência de um cliente multimarca navegando no sistema.',
      fornecedor: 'Ferramentas disponíveis para usuários de fornecedores gerenciarem produtos e pedidos.'
    };
    return descriptions[currentView];
  };

  return (
    <div className="space-y-8">
      <style>{`
        .shadow-neumorphic { box-shadow: 8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff; }
        .shadow-neumorphic-button { box-shadow: 5px 5px 10px #b8b9be, -5px -5px 10px #ffffff; }
        .shadow-neumorphic-button-inset { box-shadow: inset 5px 5px 10px #b8b9be, inset -5px -5px 10px #ffffff; }
      `}</style>

      <AdminViewSelector currentView={currentView} onViewChange={setCurrentView} />
      
      <div>
        <h1 className="text-4xl font-bold text-gray-800">{getViewTitle()}</h1>
        <p className="text-gray-600 mt-2 text-lg">{getViewDescription()}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {getCardsForView().map(card => (
          <Card key={card.title} className="bg-slate-100 rounded-2xl shadow-neumorphic transition-transform hover:scale-105">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <card.icon className={`w-6 h-6 ${card.color}`} />
                <span className="text-gray-800">{card.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="text-gray-600 mb-4 flex-grow">{card.description}</p>
              {card.link ? (
                <Link to={createPageUrl(card.link)} className="mt-auto">
                  <Button className="w-full bg-slate-200 text-gray-800 font-semibold rounded-lg shadow-neumorphic-button active:shadow-neumorphic-button-inset transition-all hover:bg-slate-300">
                    {currentView === 'admin' ? 'Gerenciar' : 'Acessar'}
                  </Button>
                </Link>
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  Em Breve
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {currentView !== 'admin' && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-800">Modo de Visualização Ativa</span>
            </div>
            <p className="text-yellow-700 text-sm mt-2">
              Você está vendo o sistema na perspectiva de um {currentView === 'cliente' ? 'cliente/multimarca' : 'fornecedor'}. 
              As funcionalidades mostradas são limitadas conforme as permissões deste tipo de usuário.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}