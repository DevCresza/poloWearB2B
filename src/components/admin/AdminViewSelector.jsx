import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building, Shield, Eye } from 'lucide-react';

export default function AdminViewSelector({ currentView, onViewChange }) {
  const views = [
    {
      key: 'admin',
      title: 'Visão Administrador',
      description: 'Acesso completo a todas funcionalidades',
      icon: Shield,
      color: 'bg-red-50 border-red-200 text-red-700'
    },
    {
      key: 'cliente',
      title: 'Visão Cliente/Multimarca', 
      description: 'Como um cliente vê o sistema',
      icon: Users,
      color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      key: 'fornecedor',
      title: 'Visão Fornecedor',
      description: 'Como um fornecedor vê o sistema',
      icon: Building,
      color: 'bg-green-50 border-green-200 text-green-700'
    }
  ];

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-gray-600" />
          <span className="font-semibold text-gray-800">Mudar Perspectiva:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {views.map(view => (
            <Button
              key={view.key}
              variant={currentView === view.key ? "default" : "outline"}
              onClick={() => onViewChange(view.key)}
              className={`p-4 h-auto flex-col items-start ${currentView === view.key ? '' : view.color}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <view.icon className="w-5 h-5" />
                <span className="font-semibold">{view.title}</span>
              </div>
              <p className="text-xs text-left">{view.description}</p>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}