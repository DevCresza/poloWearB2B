import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Package, TrendingUp, Award, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ProductGallery() {
  const produtos = [
    {
      nome: "Polo Premium Mescla",
      imagem: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f7cbd8537575fa5229f1e6/1c9db5f45_CapturadeTela2025-10-21as143749.png",
      descricao: "Qualidade superior em malha piquet premium com detalhes refinados"
    },
    {
      nome: "Polo Grafite Premium",
      imagem: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f7cbd8537575fa5229f1e6/3662fba34_CapturadeTela2025-10-21as143752.png",
      descricao: "Design moderno com detalhes contrastantes e acabamento impecável"
    },
    {
      nome: "Camiseta Performance Azul",
      imagem: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f7cbd8537575fa5229f1e6/d5258b0c6_CapturadeTela2025-10-21as143755.png",
      descricao: "Tecnologia dry fit para máximo conforto e performance"
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 px-5 py-2.5 rounded-full text-sm font-semibold mb-6">
            <Package className="w-4 h-4" />
            <span>Qualidade Premium</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Coleções em Destaque
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Produtos que conquistam clientes e garantem vendas excepcionais para sua loja
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          {/* Product Image */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl transform -rotate-2 scale-105 opacity-10 group-hover:scale-110 transition-transform duration-500" />
            <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f7cbd8537575fa5229f1e6/535b35dd5_CapturadeTela2025-10-21as143805.png"
                alt="Produto POLO Wear Premium"
                className="w-full h-[550px] object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute top-6 left-6">
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 text-sm font-bold flex items-center gap-2 shadow-lg">
                  <Star className="w-4 h-4 fill-current" />
                  Mais Vendido
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Product Info */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
                Qualidade Premium <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">POLO Wear</span>
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Nossas peças são desenvolvidas com os melhores materiais e 
                tecnologia de ponta, garantindo conforto e durabilidade 
                incomparáveis. Bordados de alta qualidade e acabamento impecável 
                em cada detalhe.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-blue-600 mb-2">100%</div>
                <div className="text-sm font-semibold text-gray-700">Algodão Premium</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-green-600 mb-2">30+</div>
                <div className="text-sm font-semibold text-gray-700">Cores Disponíveis</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-purple-600 mb-2">P-XG</div>
                <div className="text-sm font-semibold text-gray-700">Todos Tamanhos</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">
                <div className="text-3xl font-bold text-orange-600 mb-2 flex items-center gap-1">
                  4.9<Star className="w-6 h-6 fill-current" />
                </div>
                <div className="text-sm font-semibold text-gray-700">Avaliação Média</div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-100">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
                Coleções Disponíveis:
              </h4>
              <div className="flex flex-wrap gap-3">
                <Badge className="bg-white text-blue-700 border-2 border-blue-200 px-4 py-2 text-sm font-semibold">Básica</Badge>
                <Badge className="bg-white text-purple-700 border-2 border-purple-200 px-4 py-2 text-sm font-semibold">Esportiva</Badge>
                <Badge className="bg-white text-green-700 border-2 border-green-200 px-4 py-2 text-sm font-semibold">Casual</Badge>
                <Badge className="bg-white text-orange-700 border-2 border-orange-200 px-4 py-2 text-sm font-semibold">Social</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {produtos.map((produto, index) => (
            <div key={index} className="group">
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="aspect-[3/4] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative">
                  <img 
                    src={produto.imagem}
                    alt={produto.nome}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-6">
                  <h4 className="font-bold text-xl mb-3 text-gray-900 group-hover:text-blue-600 transition-colors">
                    {produto.nome}
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {produto.descricao}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 font-semibold">
                      POLO Wear
                    </Badge>
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <Link to={createPageUrl('CadastroCompra')}>
            <Button 
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300"
            >
              <Award className="w-5 h-5 mr-2" />
              Quero Ser Multimarca
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}