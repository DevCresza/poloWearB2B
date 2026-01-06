import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, XCircle, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AlertaBloqueio() {
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      // Mostrar modal se bloqueado e é primeira vez que vê
      if (currentUser.bloqueado && !sessionStorage.getItem('bloqueio_visto')) {
        setShowModal(true);
        sessionStorage.setItem('bloqueio_visto', 'true');
      }
    } catch (error) {
    }
  };

  if (!user || !user.bloqueado) return null;

  return (
    <>
      {/* Barra de Alerta Fixa */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <p className="font-bold">⚠️ Sua conta está bloqueada por inadimplência</p>
              <p className="text-sm opacity-90">{user.motivo_bloqueio}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => navigate(createPageUrl('CarteiraFinanceira'))}
              className="bg-white text-red-600 hover:bg-gray-100"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Ver Débitos
            </Button>
            <Button 
              onClick={() => setShowModal(true)}
              variant="outline"
              className="border-white text-white hover:bg-red-700"
            >
              Detalhes
            </Button>
          </div>
        </div>
      </div>

      {/* Espaçador para não sobrepor conteúdo */}
      <div className="h-20"></div>

      {/* Modal Detalhado */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2 text-red-600">
              <XCircle className="w-8 h-8" />
              Conta Bloqueada por Inadimplência
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Sua conta foi bloqueada devido a pagamentos em atraso.</strong>
                <p className="mt-2">Você não poderá realizar novos pedidos até regularizar sua situação financeira.</p>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="font-semibold text-gray-700">Motivo do Bloqueio:</span>
                <span className="text-red-600 font-bold">{user.motivo_bloqueio}</span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b">
                <span className="font-semibold text-gray-700">Data do Bloqueio:</span>
                <span className="text-gray-900">
                  {user.data_bloqueio ? new Date(user.data_bloqueio).toLocaleDateString('pt-BR') : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b">
                <span className="font-semibold text-gray-700">Total em Aberto:</span>
                <span className="text-orange-600 font-bold text-xl">
                  R$ {(user.total_em_aberto || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">Total Vencido:</span>
                <span className="text-red-600 font-bold text-xl">
                  R$ {(user.total_vencido || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Como Regularizar:</h4>
              <ol className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Acesse a Carteira Financeira e visualize todos os títulos pendentes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Realize o pagamento dos títulos vencidos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Envie o comprovante de pagamento pelo sistema</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>Aguarde a análise do financeiro (até 24 horas úteis)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">5.</span>
                  <span>Sua conta será desbloqueada automaticamente após confirmação do pagamento</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Fechar
              </Button>
              <Button 
                onClick={() => {
                  setShowModal(false);
                  navigate(createPageUrl('CarteiraFinanceira'));
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Ir para Carteira Financeira
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}