import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Award, 
  Users, 
  Truck, 
  HeartHandshake,
  TrendingUp,
  Shield
} from 'lucide-react';

export default function BenefitsSection() {
  const benefits = [
    {
      icon: Award,
      title: "Marca Reconhecida",
      description: "25 anos de tradição e qualidade no mercado nacional com excelência comprovada",
      color: "bg-blue-50 text-blue-600",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      icon: Users,
      title: "Suporte Especializado",
      description: "Equipe dedicada para apoiar seu crescimento com consultoria personalizada",
      color: "bg-green-50 text-green-600",
      gradient: "from-green-500 to-green-600"
    },
    {
      icon: Truck,
      title: "Logística Eficiente",
      description: "Entregas rápidas e seguras em todo o país com rastreamento completo",
      color: "bg-purple-50 text-purple-600",
      gradient: "from-purple-500 to-purple-600"
    },
    {
      icon: HeartHandshake,
      title: "Parceria Sólida",
      description: "Relacionamento duradouro e transparente com foco no sucesso mútuo",
      color: "bg-teal-50 text-teal-600",
      gradient: "from-teal-500 to-teal-600"
    },
    {
      icon: TrendingUp,
      title: "Crescimento Real",
      description: "Aumente suas vendas em até 40% com produtos de alta demanda",
      color: "bg-orange-50 text-orange-600",
      gradient: "from-orange-500 to-orange-600"
    },
    {
      icon: Shield,
      title: "Segurança Garantida",
      description: "Produtos com garantia de qualidade e procedência certificada",
      color: "bg-indigo-50 text-indigo-600",
      gradient: "from-indigo-500 to-indigo-600"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Por que escolher a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">POLO Wear</span>?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Oferecemos as melhores condições para o sucesso da sua loja. 
            Conheça os benefícios exclusivos que fazem a diferença.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-2xl transition-all duration-300 border-0 shadow-lg overflow-hidden relative"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${benefit.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              <CardContent className="p-8 relative">
                <div className={`w-16 h-16 rounded-2xl ${benefit.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                  <benefit.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}