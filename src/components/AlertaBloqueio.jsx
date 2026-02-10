import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Loja } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, XCircle, DollarSign, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useLojaContext } from '@/contexts/LojaContext';

export default function AlertaBloqueio() {
  const [user, setUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [alertType, setAlertType] = useState(null); // 'global' | 'loja'
  const navigate = useNavigate();
  const { lojaSelecionada, isLojaBloqueada } = useLojaContext();

  useEffect(() => {
    checkUser();
  }, []);

  // Re-check when loja changes
  useEffect(() => {
    if (user && lojaSelecionada) {
      checkLojaBloqueio();
    }
  }, [lojaSelecionada?.id]);

  const checkUser = async () => {
    try {
      const currentUser = await User.me();

      // Verificar inadimplência automaticamente para clientes multimarca
      if (currentUser.tipo_negocio === 'multimarca' && !currentUser.bloqueado) {
        try {
          const titulosCliente = await Carteira.filter({ cliente_user_id: currentUser.id });
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          const titulosVencidos = (titulosCliente || []).filter(t => {
            if (t.status !== 'pendente') return false;
            if (!t.data_vencimento) return false;
            const dv = new Date(t.data_vencimento + 'T00:00:00');
            return dv < hoje;
          });

          const totalVencido = titulosVencidos.reduce((sum, t) => sum + (t.valor || 0), 0);

          if (titulosVencidos.length > 0 && totalVencido > 0) {
            await User.update(currentUser.id, {
              bloqueado: true,
              motivo_bloqueio: `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`,
              data_bloqueio: new Date().toISOString(),
              total_vencido: totalVencido
            });
            currentUser.bloqueado = true;
            currentUser.motivo_bloqueio = `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`;
            currentUser.total_vencido = totalVencido;
          }
        } catch (e) {
          console.warn('Erro ao verificar inadimplência:', e);
        }
      }

      setUser(currentUser);

      // Mostrar modal se bloqueado globalmente e primeira vez que vê
      if (currentUser.bloqueado && !sessionStorage.getItem('bloqueio_visto')) {
        setAlertType('global');
        setShowModal(true);
        sessionStorage.setItem('bloqueio_visto', 'true');
      }
    } catch (_error) {
    }
  };

  const checkLojaBloqueio = async () => {
    if (!lojaSelecionada) return;
    // Auto-bloqueio por loja: checar títulos vencidos filtrados por loja_id
    if (user?.tipo_negocio === 'multimarca' && !lojaSelecionada.bloqueada) {
      try {
        const titulosLoja = await Carteira.filter({
          cliente_user_id: user.id,
          loja_id: lojaSelecionada.id
        });
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const titulosVencidos = (titulosLoja || []).filter(t => {
          if (t.status !== 'pendente') return false;
          if (!t.data_vencimento) return false;
          const dv = new Date(t.data_vencimento + 'T00:00:00');
          return dv < hoje;
        });

        const totalVencido = titulosVencidos.reduce((sum, t) => sum + (t.valor || 0), 0);

        if (titulosVencidos.length > 0 && totalVencido > 0) {
          await Loja.update(lojaSelecionada.id, {
            bloqueada: true,
            motivo_bloqueio: `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`,
            data_bloqueio: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn('Erro ao verificar inadimplência por loja:', e);
      }
    }
  };

  const isGlobalBlocked = user?.bloqueado;
  const isLojaBlocked = !isGlobalBlocked && isLojaBloqueada;

  if (!user || (!isGlobalBlocked && !isLojaBlocked)) return null;

  const barMessage = isGlobalBlocked
    ? 'Sua conta está bloqueada por inadimplência'
    : `Loja "${lojaSelecionada?.nome_fantasia || lojaSelecionada?.nome}" está bloqueada`;

  const barDetail = isGlobalBlocked
    ? user.motivo_bloqueio
    : lojaSelecionada?.motivo_bloqueio;

  return (
    <>
      {/* Barra de Alerta Fixa */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-3 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLojaBlocked ? <Store className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            <div>
              <p className="font-bold">{barMessage}</p>
              {barDetail && <p className="text-sm opacity-90">{barDetail}</p>}
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
              onClick={() => {
                setAlertType(isGlobalBlocked ? 'global' : 'loja');
                setShowModal(true);
              }}
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
              {alertType === 'global'
                ? 'Conta Bloqueada por Inadimplência'
                : `Loja Bloqueada`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">
                {alertType === 'global' ? (
                  <>
                    <strong>Sua conta foi bloqueada devido a pagamentos em atraso.</strong>
                    <p className="mt-2">Você não poderá realizar novos pedidos até regularizar sua situação financeira.</p>
                  </>
                ) : (
                  <>
                    <strong>A loja "{lojaSelecionada?.nome_fantasia || lojaSelecionada?.nome}" foi bloqueada.</strong>
                    <p className="mt-2">Você não poderá realizar pedidos nesta loja até regularizar a situação.</p>
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="font-semibold text-gray-700">Motivo do Bloqueio:</span>
                <span className="text-red-600 font-bold text-sm text-right max-w-[60%]">
                  {alertType === 'global' ? user.motivo_bloqueio : lojaSelecionada?.motivo_bloqueio || 'Não informado'}
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b">
                <span className="font-semibold text-gray-700">Data do Bloqueio:</span>
                <span className="text-gray-900">
                  {(() => {
                    const dt = alertType === 'global' ? user.data_bloqueio : lojaSelecionada?.data_bloqueio;
                    return dt ? new Date(dt).toLocaleDateString('pt-BR') : 'N/A';
                  })()}
                </span>
              </div>

              {alertType === 'global' && (
                <>
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
                </>
              )}
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
