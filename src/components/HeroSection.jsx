import { Button } from '@/components/ui/button';
import { ArrowRight, Store, TrendingUp, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function HeroSection({ onScrollToContact }) {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(156,163,175,0.05),transparent_50%)]" />
      
      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-screen">
          {/* Text Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 px-5 py-2.5 rounded-full text-sm font-semibold border border-blue-100">
              <Store className="w-4 h-4" />
              <span>Oportunidade de Negócio Exclusiva</span>
            </div>
            
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">
                Seja uma
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  POLO WEAR
                </span>
                <span className="block text-gray-700">Multimarca</span>
              </h1>
              
              <p className="text-xl lg:text-2xl text-gray-600 leading-relaxed max-w-xl">
                Junte-se à rede de multimarcas mais inovadora do Brasil. 
                Conecte-se com o estilo contemporâneo e conquiste novos clientes com produtos de qualidade premium.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to={createPageUrl('CadastroCompra')}>
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 group w-full sm:w-auto"
                >
                  Quero ser Multimarca
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              
              <Button 
                size="lg"
                variant="outline"
                onClick={onScrollToContact}
                className="border-2 border-gray-300 hover:border-blue-600 px-8 py-6 text-lg font-semibold rounded-xl transition-all w-full sm:w-auto"
              >
                Saiba Mais
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center p-4 bg-white rounded-xl shadow-md">
                <div className="text-3xl font-bold text-blue-600 mb-1">500+</div>
                <div className="text-sm text-gray-600 font-medium">Lojas Parceiras</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl shadow-md">
                <div className="text-3xl font-bold text-purple-600 mb-1">25+</div>
                <div className="text-sm text-gray-600 font-medium">Anos de Mercado</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl shadow-md">
                <div className="text-3xl font-bold text-green-600 mb-1">100%</div>
                <div className="text-sm text-gray-600 font-medium">Satisfação</div>
              </div>
            </div>
          </div>
          
          {/* Image Content */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl transform rotate-3 scale-105 opacity-10" />
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f7cbd8537575fa5229f1e6/fafcb19d5_CapturadeTela2025-10-21as143802.png"
                alt="Produtos POLO Wear"
                className="w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl p-5 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-lg text-gray-900">Crescimento Garantido</div>
                      <div className="text-sm text-gray-600">Aumente suas vendas em até 40%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Badge */}
            <div className="absolute -top-4 -right-4 bg-gradient-to-br from-yellow-400 to-orange-500 text-white p-6 rounded-2xl shadow-xl transform rotate-6 hover:rotate-12 transition-transform">
              <Award className="w-8 h-8 mb-2" />
              <div className="font-bold text-lg">25 Anos</div>
              <div className="text-sm">de Tradição</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}