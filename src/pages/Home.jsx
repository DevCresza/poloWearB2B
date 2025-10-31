
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogIn, UserPlus, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-12">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f7cbd8537575fa5229f1e6/e064af0f6_image.png"
            alt="Polo Wear"
            className="w-48 h-48 mx-auto mb-8"
          />
          <div className="h-1 w-32 bg-gradient-to-r from-blue-500 to-red-500 mx-auto mb-6"></div>
          <h1 className="text-3xl md:text-4xl font-light text-white mb-4">
            Portal de Compras Franqueados
          </h1>
          <p className="text-gray-400 text-lg">
            Acesse sua conta para fazer pedidos e acompanhar suas compras
          </p>
        </div>

        {/* Card Principal */}
        <Card className="bg-zinc-900 border-zinc-800 rounded-3xl p-8 md:p-12 mb-8 shadow-2xl">
          <div className="space-y-6">
            {/* Botão Principal - Acessar Minha Conta */}
            <Link to={createPageUrl('CadastroCompra') + '?view=login'} className="block">
              <Button className="w-full h-20 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xl font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 border-2 border-blue-500">
                <div className="flex items-center justify-center gap-4">
                  <LogIn className="w-8 h-8" />
                  <div className="flex flex-col items-start">
                    <span className="text-2xl">Acessar Minha Conta</span>
                    <span className="text-sm font-normal text-blue-200">Faça login para continuar</span>
                  </div>
                  <ArrowRight className="w-8 h-8" />
                </div>
              </Button>
            </Link>

            {/* Separador */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 text-gray-500 bg-zinc-900">ou</span>
              </div>
            </div>

            {/* Botão Secundário - Primeiro Acesso */}
            <Link to={createPageUrl('CadastroCompra') + '?view=register'} className="block">
              <Button className="w-full h-14 bg-white hover:bg-gray-100 text-black text-base rounded-xl transition-all border-2 border-gray-300 hover:border-blue-600">
                <div className="flex items-center justify-center gap-3">
                  <UserPlus className="w-5 h-5" />
                  <span>Primeiro Acesso / Cadastro</span>
                </div>
              </Button>
            </Link>
          </div>
        </Card>

        {/* Informações de Suporte */}
        <div className="text-center space-y-3">
          <p className="text-gray-500 text-sm">
            Portal B2B Polo Wear © 2025
          </p>
          <p className="text-gray-600 text-xs">
            Dúvidas? Entre em contato com nossa equipe de suporte
          </p>
          
          {/* Acesso Admin */}
          <div className="pt-4">
            <Link 
              to={createPageUrl('PortalDashboard')} 
              className="text-gray-700 hover:text-gray-500 text-xs transition-colors inline-flex items-center gap-1"
            >
              <LogIn className="w-3 h-3" />
              Acesso Administrativo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
