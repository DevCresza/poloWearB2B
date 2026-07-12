import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { User } from '@/api/entities';

/**
 * Usuario logado, buscado UMA vez por navegacao.
 *
 * Antes, o Layout fazia o proprio User.me() e cada pagina fazia o seu — e o
 * "guard" era um useEffect que redirecionava DEPOIS da pagina ja ter montado e
 * disparado seus fetches. Aqui o usuario e resolvido antes de a rota renderizar,
 * e o ProtectedRoute decide com base nele.
 */

const AuthContext = createContext({ user: null, loading: true, refresh: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const carregar = useCallback(async () => {
    try {
      const u = await User.me();
      setUser(u || null);
    } catch {
      setUser(null); // nao autenticado
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const u = await User.me();
        if (vivo) setUser(u || null);
      } catch {
        if (vivo) setUser(null);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [location.pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: carregar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
