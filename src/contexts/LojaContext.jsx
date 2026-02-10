import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Loja } from '@/api/entities';

const LojaContext = createContext(null);

export function LojaProvider({ children, user }) {
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionadaState] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadLojas = useCallback(async () => {
    if (!user?.id) {
      setLojas([]);
      setLojaSelecionadaState(null);
      setLoading(false);
      return;
    }

    try {
      const lojasList = await Loja.filter({ user_id: user.id, ativa: true });
      setLojas(lojasList || []);

      // Restore selection from localStorage
      const storageKey = `loja_selecionada_${user.id}`;
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
  }, [user?.id]);

  useEffect(() => {
    loadLojas();
  }, [loadLojas]);

  const setLojaSelecionada = useCallback((loja) => {
    setLojaSelecionadaState(loja);
    if (user?.id) {
      const storageKey = `loja_selecionada_${user.id}`;
      if (loja) {
        localStorage.setItem(storageKey, loja.id);
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [user?.id]);

  // Helper: returns loja_id filter value (or undefined if "todas")
  const lojaFilterId = lojaSelecionada?.id || null;

  // Cart is always global (store selection happens at checkout time)
  const carrinhoKey = 'carrinho';

  return (
    <LojaContext.Provider value={{
      lojas,
      lojaSelecionada,
      setLojaSelecionada,
      loadLojas,
      loading,
      lojaFilterId,
      carrinhoKey,
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
      hasMultipleLojas: false,
      hasSingleLoja: false,
      hasNoLojas: true,
      isLojaBloqueada: false,
    };
  }
  return ctx;
}

export default LojaContext;
