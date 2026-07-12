import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@/api/entities';
import { isVendedor as ehVendedor, isCliente as ehCliente } from '@/utils/roles';

/**
 * "Em nome de quem eu compro."
 *
 * Cliente comprando: o sujeito e ele mesmo.
 * Vendedor comprando: o sujeito e o CLIENTE ALVO que ele escolheu.
 *
 * Isso importa muito mais do que parece: preco, visibilidade de produto, pedido
 * minimo, direito a boleto e checagem de inadimplencia sao todos derivados do
 * SUJEITO. Se o Catalogo/Carrinho usarem o vendedor por engano, o sistema vende
 * com preco de franqueado para um multimarca e libera boleto para quem nao pode.
 *
 * O padrao ja existia no EmissaoLote (admin emite em nome de varias lojas).
 */

const RepresentacaoContext = createContext(null);

const chaveClienteAlvo = (vendedorId) => `vendedor_cliente_alvo_${vendedorId}`;

export function RepresentacaoProvider({ children, user }) {
  const vendedor = ehVendedor(user);
  const [clientes, setClientes] = useState([]);
  const [clienteAlvo, setClienteAlvoState] = useState(null);
  const [loading, setLoading] = useState(vendedor);

  useEffect(() => {
    if (!vendedor || !user?.id) {
      setClientes([]);
      setClienteAlvoState(null);
      setLoading(false);
      return;
    }

    let vivo = true;
    (async () => {
      try {
        const todos = await User.list();
        const lista = (todos || []).filter(u => ehCliente(u) && u.ativo !== false);
        if (!vivo) return;
        setClientes(lista);

        const salvo = localStorage.getItem(chaveClienteAlvo(user.id));
        setClienteAlvoState(salvo ? (lista.find(c => c.id === salvo) || null) : null);
      } catch (err) {
        console.warn('Erro ao carregar clientes para representação:', err);
        if (vivo) setClientes([]);
      } finally {
        if (vivo) setLoading(false);
      }
    })();

    return () => { vivo = false; };
  }, [vendedor, user?.id]);

  const setClienteAlvo = useCallback((cliente) => {
    setClienteAlvoState(cliente);
    if (!user?.id) return;
    const chave = chaveClienteAlvo(user.id);
    if (cliente) localStorage.setItem(chave, cliente.id);
    else localStorage.removeItem(chave);
  }, [user?.id]);

  // O sujeito da compra.
  const usuarioCompra = vendedor ? clienteAlvo : user;

  // Carrinho isolado por vendedor E por cliente: o vendedor pode montar pedidos
  // para varios clientes em paralelo sem misturar, e nunca toca no carrinho do
  // proprio cliente (que segue na chave global 'carrinho').
  const carrinhoKey = useMemo(() => {
    if (!vendedor) return 'carrinho';
    if (!clienteAlvo) return `carrinho_vend_${user?.id}_nenhum`;
    return `carrinho_vend_${user?.id}_cli_${clienteAlvo.id}`;
  }, [vendedor, user?.id, clienteAlvo]);

  const valor = useMemo(() => ({
    isVendedor: vendedor,
    clientes,
    clienteAlvo,
    setClienteAlvo,
    usuarioCompra,
    carrinhoKey,
    loading,
    // Vendedor sem cliente escolhido nao compra.
    podeComprar: !!usuarioCompra,
  }), [vendedor, clientes, clienteAlvo, setClienteAlvo, usuarioCompra, carrinhoKey, loading]);

  return (
    <RepresentacaoContext.Provider value={valor}>
      {children}
    </RepresentacaoContext.Provider>
  );
}

export function useRepresentacao() {
  return useContext(RepresentacaoContext) ?? {
    isVendedor: false,
    clientes: [],
    clienteAlvo: null,
    setClienteAlvo: () => {},
    usuarioCompra: null,
    carrinhoKey: 'carrinho',
    loading: false,
    podeComprar: false,
  };
}

/** Limpa carrinhos e cliente alvo do vendedor (chamado no logout). */
export function limparRepresentacao() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('carrinho_vend_') || k.startsWith('vendedor_cliente_alvo_'))
    .forEach(k => localStorage.removeItem(k));
}

export default RepresentacaoContext;
