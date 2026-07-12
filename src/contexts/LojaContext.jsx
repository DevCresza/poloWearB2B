import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Loja } from '@/api/entities';
import { useRepresentacao } from './RepresentacaoContext';

const LojaContext = createContext(null);

export function LojaProvider({ children, user }) {
  // As lojas sao SEMPRE do sujeito da compra: o proprio cliente, ou o cliente
  // alvo quando quem esta comprando e um vendedor. Sem isto, o vendedor veria
  // (e entregaria em) as lojas dele, nao as do cliente.
  const { usuarioCompra, carrinhoKey, isVendedor } = useRepresentacao();
  const sujeito = usuarioCompra || user;

  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionadaState] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadLojas = useCallback(async () => {
    if (!sujeito?.id) {
      setLojas([]);
      setLojaSelecionadaState(null);
      setLoading(false);
      return;
    }

    try {
      const lojasList = await Loja.filter({ user_id: sujeito.id, ativa: true });
      setLojas(lojasList || []);

      // Restore selection from localStorage
      const storageKey = `loja_selecionada_${sujeito.id}`;
      const savedId = localStorage.getItem(storageKey);

      if (lojasList.length === 1) {
        // Auto-select if only 1 store
        setLojaSelecionadaState(lojasList[0]);
        localStorage.setItem(storageKey, lojasList[0].id);
      } else if (lojasList.length > 1 && savedId) {
        const found = lojasList.find(l => l.id === savedId);
        setLojaSelecionadaState(found || null); // null = "Todas as Lojas"
      } else {
        setLojaSelecionadaState(null);
      }
    } catch (err) {
      console.warn('Erro ao carregar lojas:', err);
      setLojas([]);
    } finally {
      setLoading(false);
    }
  }, [sujeito?.id]);

  useEffect(() => {
    loadLojas();
  }, [loadLojas]);

  const setLojaSelecionada = useCallback((loja) => {
    setLojaSelecionadaState(loja);
    if (sujeito?.id) {
      const storageKey = `loja_selecionada_${sujeito.id}`;
      if (loja) {
        localStorage.setItem(storageKey, loja.id);
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [sujeito?.id]);

  // Helper: returns loja_id filter value (or undefined if "todas")
  const lojaFilterId = lojaSelecionada?.id || null;

  return (
    <LojaContext.Provider value={{
      lojas,
      lojaSelecionada,
      setLojaSelecionada,
      loadLojas,
      loading,
      lojaFilterId,
      // Chave do carrinho vem da representacao: global para o cliente,
      // isolada por (vendedor, cliente) para o vendedor.
      carrinhoKey,
      // Vendedor precisa escolher a loja de entrega: sem isso o pedido cairia
      // no endereco do proprio vendedor (Carrinho usa `loja || user`).
      exigeLoja: isVendedor,
      hasMultipleLojas: lojas.length > 1,
      hasSingleLoja: lojas.length === 1,
      hasNoLojas: lojas.length === 0,
      isLojaBloqueada: lojaSelecionada?.bloqueada === true,
    }}>
      {children}
    </LojaContext.Provider>
  );
}

export function useLojaContext() {
  const ctx = useContext(LojaContext);
  if (!ctx) {
    // Return safe defaults when used outside provider (e.g. admin/fornecedor)
    return {
      lojas: [],
      lojaSelecionada: null,
      setLojaSelecionada: () => {},
      loadLojas: () => {},
      loading: false,
      lojaFilterId: null,
      carrinhoKey: 'carrinho',
      exigeLoja: false,
      hasMultipleLojas: false,
      hasSingleLoja: false,
      hasNoLojas: true,
      isLojaBloqueada: false,
    };
  }
  return ctx;
}

export default LojaContext;
