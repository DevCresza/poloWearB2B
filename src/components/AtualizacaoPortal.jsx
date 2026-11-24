import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { VERSAO_ATUAL, conferirVersao, versaoDesatualizada } from '@/utils/versaoApp';

// Mantém a aba no código publicado. Ver src/utils/versaoApp.js.
//
// - Confere a versão ao abrir, a cada 10 minutos e quando a aba volta a ficar
//   visível.
// - Versão nova + troca de página: recarrega na hora (a URL já é a da página
//   de destino, então o usuário só vê a página abrir).
// - Versão nova + aba que ficou escondida 30 min ou mais: recarrega ao voltar.
//   É o caso da aba esquecida aberta de um dia para o outro.
// - Versão nova com o usuário na tela: aviso fixo com o botão "Atualizar", sem
//   recarregar sozinho, para não perder o que está sendo preenchido.

const INTERVALO_MS = 10 * 60 * 1000;
const ESCONDIDA_LONGA_MS = 30 * 60 * 1000;
const ID_AVISO = 'versao-nova-portal';

const CHAVE_RECARGA = 'polo_recarga_versao';

const recarregar = () => window.location.reload();

// Recarga automática uma vez por versão: se depois de recarregar a aba ainda
// vier com o mesmo JS (cache no caminho), não entra em laço; fica só o aviso.
function recarregarSozinho() {
  let jaTentou = false;
  try { jaTentou = sessionStorage.getItem(CHAVE_RECARGA) === VERSAO_ATUAL; } catch { /* sem storage */ }
  if (jaTentou) { avisar(); return; }
  try { sessionStorage.setItem(CHAVE_RECARGA, VERSAO_ATUAL); } catch { /* sem storage */ }
  recarregar();
}

function avisar() {
  toast('Há uma versão nova do portal', {
    id: ID_AVISO,
    description: 'Atualize a página para continuar com a versão mais recente.',
    duration: Infinity,
    action: { label: 'Atualizar', onClick: recarregar },
  });
}

export default function AtualizacaoPortal() {
  const location = useLocation();
  const primeiraRota = useRef(true);
  const escondidaDesde = useRef(null);

  // Troca de página com versão velha: recarrega.
  useEffect(() => {
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    if (versaoDesatualizada()) recarregarSozinho();
  }, [location.pathname]);

  useEffect(() => {
    let ativo = true;

    const conferir = async ({ voltouDeLonge = false, forcar = false } = {}) => {
      const velha = await conferirVersao({ forcar });
      if (!ativo || !velha) return;
      if (voltouDeLonge) recarregarSozinho();
      else avisar();
    };

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') {
        escondidaDesde.current = Date.now();
        return;
      }
      const desde = escondidaDesde.current;
      escondidaDesde.current = null;
      const voltouDeLonge = desde !== null && Date.now() - desde >= ESCONDIDA_LONGA_MS;
      conferir({ voltouDeLonge, forcar: voltouDeLonge });
    };

    conferir({ forcar: true });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') conferir();
    }, INTERVALO_MS);
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      ativo = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, []);

  return null;
}
