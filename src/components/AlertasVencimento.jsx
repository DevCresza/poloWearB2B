
import { useState, useEffect } from 'react';
import { Carteira } from '@/api/entities';
import { User } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, X, DollarSign, Calendar, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AlertasVencimento() {
  const [alertas, setAlertas] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlertas();
    
    // Verificar alertas a cada 5 minutos
    const interval = setInterval(loadAlertas, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAlertas = async () => {
    try {
      const user = await User.me();
      
      // Apenas para clientes
      if (user.tipo_negocio !== 'multimarca') {
        setLoading(false);
        return;
      }

      const titulos = await Carteira.filter({ 
        cliente_user_id: user.id,
        status: 'pendente'
      });

      const hoje = new Date();
      const alertasAtivos = [];

      titulos.forEach(titulo => {
        const vencimento = new Date(titulo.data_vencimento);
        const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));

        // Alertas de vencimento
        if (diffDias < 0) {
          alertasAtivos.push({
            id: `vencido-${titulo.id}`,
            tipo: 'vencido',
            titulo: 'Título Vencido',
            mensagem: `Pagamento vencido há ${Math.abs(diffDias)} dia(s)`,
            valor: titulo.valor,
            tituloId: titulo.id,
            prioridade: 'alta'
          });
        } else if (diffDias === 0) {
          alertasAtivos.push({
            id: `vence-hoje-${titulo.id}`,
            tipo: 'vence_hoje',
            titulo: 'Vencimento Hoje',
            mensagem: 'Este título vence hoje!',
            valor: titulo.valor,
            tituloId: titulo.id,
            prioridade: 'alta'
          });
        } else if (diffDias <= 2) {
          alertasAtivos.push({
            id: `vence-2dias-${titulo.id}`,
            tipo: 'vence_em_breve',
            titulo: 'Vence em Breve',
            mensagem: `Vencimento em ${diffDias} dia(s)`,
            valor: titulo.valor,
            tituloId: titulo.id,
            prioridade: 'media'
          });
        } else if (diffDias <= 7) {
          alertasAtivos.push({
            id: `vence-7dias-${titulo.id}`,
            tipo: 'vence_proxima_semana',
            titulo: 'Vence na Próxima Semana',
            mensagem: `Vencimento em ${diffDias} dias`,
            valor: titulo.valor,
            tituloId: titulo.id,
            prioridade: 'baixa'
          });
        }
      });

      // Filtrar alertas já dispensados
      const dismissedIds = JSON.parse(localStorage.getItem('alertas-dismissed') || '[]');
      const alertasFiltrados = alertasAtivos.filter(a => !dismissedIds.includes(a.id));

      setAlertas(alertasFiltrados);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (alertaId) => {
    const dismissed = JSON.parse(localStorage.getItem('alertas-dismissed') || '[]');
    dismissed.push(alertaId);
    localStorage.setItem('alertas-dismissed', JSON.stringify(dismissed));
    
    setAlertas(alertas.filter(a => a.id !== alertaId));
  };

  if (loading || alertas.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-md">
      {alertas.map(alerta => {
        const bgColor = alerta.prioridade === 'alta' ? 'bg-red-50 border-red-200' :
                       alerta.prioridade === 'media' ? 'bg-orange-50 border-orange-200' :
                       'bg-yellow-50 border-yellow-200';
        
        const textColor = alerta.prioridade === 'alta' ? 'text-red-800' :
                         alerta.prioridade === 'media' ? 'text-orange-800' :
                         'text-yellow-800';

        return (
          <Alert key={alerta.id} className={`${bgColor} shadow-lg animate-in slide-in-from-right`}>
            <div className="flex items-start justify-between gap-3">
              <AlertTriangle className={`h-5 w-5 ${textColor} flex-shrink-0 mt-0.5`} />
              <div className="flex-1">
                <AlertDescription className={textColor}>
                  <div className="font-semibold mb-1">{alerta.titulo}</div>
                  <div className="text-sm mb-2">{alerta.mensagem}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-white/50">
                      <DollarSign className="w-3 h-3 mr-1" />
                      R$ {alerta.valor?.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Link to={createPageUrl('CarteiraFinanceira')}>
                      <Button size="sm" className="h-7 text-xs">
                        Ver Carteira
                      </Button>
                    </Link>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs"
                      onClick={() => handleDismiss(alerta.id)}
                    >
                      Dispensar
                    </Button>
                  </div>
                </AlertDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 -mt-1"
                onClick={() => handleDismiss(alerta.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
