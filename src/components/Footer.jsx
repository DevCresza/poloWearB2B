import { MapPin, Settings, ShoppingCart, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Informações da empresa */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-bold mb-4 text-white">
              Espaço Showroom
            </h3>
            <p className="text-gray-300 max-w-lg mx-auto md:mx-0 mb-4">
              Agende sua visita com nosso time comercial e conheça nossas coleções.
            </p>
            <div className="inline-flex items-center justify-center gap-2 mt-2 text-gray-200 bg-gray-800 px-4 py-2 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-400" />
              <span>R. Prof. João Brito, 104 - Vila Nova Conceição</span>
            </div>
          </div>
          
          {/* Acesso ao Sistema */}
          <div className="text-center">
            <h4 className="text-lg font-semibold mb-4 text-white">
              Já é Cliente?
            </h4>
            <p className="text-gray-300 mb-4">
              Acesse nosso catálogo exclusivo e faça seus pedidos online.
            </p>
            <Link 
              to={createPageUrl('CadastroCompra?view=login')} 
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-300 mb-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Acessar Catálogo
            </Link>
            <p className="text-gray-400 text-xs">
              Para clientes cadastrados
            </p>
          </div>
          
          {/* Link para área administrativa */}
          <div className="text-center md:text-right">
            <h4 className="text-lg font-semibold mb-4 text-white">
              Área Administrativa
            </h4>
            <p className="text-gray-300 mb-4">
              Painel de controle para administradores do sistema.
            </p>
            <Link 
              to={createPageUrl('UserManagement')} 
              className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-300"
            >
              <Settings className="w-4 h-4" />
              Painel Admin
            </Link>
            <p className="text-gray-400 text-xs mt-2">
              Acesso restrito
            </p>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 mt-8">
          <p className="text-gray-400 text-sm text-center">
            © 2024 POLO Wear. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}