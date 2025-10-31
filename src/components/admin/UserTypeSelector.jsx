import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building, Shield, ArrowRight } from 'lucide-react';

const userTypes = [
  {
    type: 'multimarca',
    title: 'Cliente/Franqueado',
    description: 'Loja multimarca ou franquia que compra produtos',
    icon: Users,
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconColor: 'text-blue-600'
  },
  {
    type: 'fornecedor',
    title: 'Usuário de Fornecedor',
    description: 'Funcionário de fornecedor com acesso ao sistema',
    icon: Building,
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    iconColor: 'text-green-600'
  },
  {
    type: 'admin',
    title: 'Administrador',
    description: 'Acesso completo ao sistema',
    icon: Shield,
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    iconColor: 'text-purple-600'
  }
];

export default function UserTypeSelector({ onSelect }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tipo de Usuário</h2>
        <p className="text-gray-600">Selecione o tipo de usuário que deseja cadastrar</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userTypes.map((userType) => (
          <Card 
            key={userType.type}
            className={`${userType.color} border-2 cursor-pointer transition-all duration-300 hover:shadow-lg`}
            onClick={() => onSelect(userType.type)}
          >
            <CardContent className="p-6 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center`}>
                <userType.icon className={`w-8 h-8 ${userType.iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{userType.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{userType.description}</p>
              <Button variant="outline" className="w-full">
                Selecionar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}