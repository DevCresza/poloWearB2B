import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Produto } from '@/api/entities';
import { darBaixaEstoque } from '@/utils/estoqueUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ShoppingCart, Trash2, Plus, Minus, Package, AlertTriangle,
  CheckCircle, CreditCard, ArrowRight, Building, ArrowLeft,
  XCircle, DollarSign, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatCurrency } from '@/utils/exportUtils';
import { useLojaContext } from '@/contexts/LojaContext';
import { useRepresentacao } from '@/contexts/RepresentacaoContext';
import { isVendedor as ehVendedor } from '@/utils/roles';
import { getPrecoPeca, getPrecoGrade } from '@/utils/precoCliente';
import { Store } from 'lucide-react';
import { Loja } from '@/api/entities';
import ReplicarPedidoModal from '@/components/pedidos/ReplicarPedidoModal';

export default function Carrinho() {
  const navigate = useNavigate();
  const { lojas, carrinhoKey, hasNoLojas, exigeLoja } = useLojaContext();
  const { isVendedor, clienteAlvo } = useRepresentacao();

  // `usuarioLogado` = quem esta na frente da tela.
  // `user`          = EM NOME DE QUEM se compra (o cliente alvo, se for vendedor).
  //
  // Praticamente tudo aqui — preco, pedido minimo, direito a boleto, checagem de
  // inadimplencia, bloqueio, endereco de entrega e o comprador_user_id do pedido
  // — e propriedade do COMPRADOR, nunca de quem opera a tela. Por isso `user`
  // aponta para o sujeito: assim nenhuma regra pode olhar a pessoa errada por
  // esquecimento.
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const user = isVendedor ? clienteAlvo : usuarioLogado;
  const [carrinho, setCarrinho] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState({});
  const [metodoPagamento, setMetodoPagamento] = useState({});
  const [observacoes, setObservacoes] = useState({});
  const [showBloqueioModal, setShowBloqueioModal] = useState(false);
  const [dadosInadimplencia, setDadosInadimplencia] = useState(null);
  const [replicarModalOpen, setReplicarModalOpen] = useState(false);
  const [replicarGrupo, setReplicarGrupo] = useState(null);
  const [replicarPreSelectedIds, setReplicarPreSelectedIds] = useState([]);
  // Per-supplier-group selected lojas: { fornecedor_id: Set<loja_id> }
  const [selectedLojasMap, setSelectedLojasMap] = useState({});
  const [capsulaProdutosExpandidos, setCapsulaProdutosExpandidos] = useState({});

  useEffect(() => {
    loadData();
    // Trocar de cliente alvo revalida inadimplencia/bloqueio do novo comprador.
  }, [clienteAlvo?.id]);

  useEffect(() => {
    loadCarrinho();
  }, [carrinhoKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUsuarioLogado(currentUser);

      const [fornecedoresList, produtosList] = await Promise.all([
        Fornecedor.list(),
        Produto.list()
      ]);

      setFornecedores(fornecedoresList || []);
      setProdutos(produtosList || []);

      // Inadimplencia e do COMPRADOR (o cliente alvo, quando for vendedor).
      const vendedorOperando = ehVendedor(currentUser);
      const comprador = vendedorOperando ? clienteAlvo : currentUser;

      if (comprador && comprador.tipo_negocio === 'multimarca') {
        try {
          const titulosCliente = await Carteira.filter({ cliente_user_id: comprador.id });
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);

          const titulosVencidos = (titulosCliente || []).filter(t => {
            if (t.status !== 'pendente') return false;
            if (!t.data_vencimento) return false;
            if (!t.parcela_numero) return false; // ignora placeholders sem parcela real
            const dv = new Date(t.data_vencimento + 'T00:00:00');
            return dv < hoje;
          });

          const totalVencido = titulosVencidos.reduce((sum, t) => sum + (t.valor || 0), 0);

          if (titulosVencidos.length > 0 && totalVencido > 0) {
            // O vendedor NAO bloqueia a conta do cliente: ele so abriu o carrinho
            // dele. O auto-bloqueio continua sendo consequencia do proprio cliente
            // acessar a conta. O checkout barra os dois casos de qualquer forma.
            if (!comprador.bloqueado && !vendedorOperando) {
              await User.update(comprador.id, {
                bloqueado: true,
                motivo_bloqueio: `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`,
                data_bloqueio: new Date().toISOString(),
                total_vencido: totalVencido
              });
              comprador.bloqueado = true;
              comprador.motivo_bloqueio = `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`;
              setUsuarioLogado({ ...comprador });
            }

            setDadosInadimplencia({ titulosVencidos, totalVencido });
            setShowBloqueioModal(true);
          }
        } catch (e) {
          console.warn('Erro ao verificar inadimplência:', e);
        }
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const loadCarrinho = () => {
    const carrinhoSalvo = localStorage.getItem(carrinhoKey);
    if (carrinhoSalvo) {
      setCarrinho(JSON.parse(carrinhoSalvo));
    } else {
      setCarrinho([]);
    }
  };

  const salvarCarrinho = (novoCarrinho) => {
    setCarrinho(novoCarrinho);
    localStorage.setItem(carrinhoKey, JSON.stringify(novoCarrinho));
  };

  // Total de pecas de um item de capsula: soma dos produtos configurados
  // (grade -> qtd x pecas_por_grade; por tamanho -> qtd ja em pecas) x o
  // multiplicador (quantas vezes a capsula).
  const calcularPecasCapsula = (item) => {
    const cfg = item.produtos_quantidades || {};
    let pecasPorCapsula = 0;
    Object.entries(cfg).forEach(([pid, config]) => {
      const prod = produtos.find(p => p.id === pid);
      const pecasGrade = (prod && prod.tipo_venda === 'grade')
        ? (Number(prod.total_pecas_grade) || 1)
        : 1;
      if (config && typeof config === 'object' && Array.isArray(config.variantes)) {
        config.variantes.forEach(v => { pecasPorCapsula += (Number(v.quantidade) || 0) * pecasGrade; });
      } else if (config && typeof config === 'object' && Array.isArray(config.tamanhos)) {
        config.tamanhos.forEach(t => { pecasPorCapsula += (Number(t.quantidade) || 0); });
      } else if (typeof config === 'number') {
        pecasPorCapsula += config * pecasGrade;
      }
    });
    return pecasPorCapsula * (Number(item.quantidade) || 1);
  };

  // Pedido minimo do fornecedor conforme o tipo do cliente logado.
  // Multimarca: pedido_minimo_multimarca; Franqueado: pedido_minimo_franqueado.
  // Fallback: pedido_minimo_valor (legado) se o campo especifico nao estiver setado.
  const getMinimoFornecedor = (fornecedor) => {
    if (!fornecedor) return 0;
    const isMulti = user?.tipo_negocio === 'multimarca';
    const especifico = isMulti
      ? fornecedor.pedido_minimo_multimarca
      : fornecedor.pedido_minimo_franqueado;
    const v = Number(especifico);
    if (Number.isFinite(v) && v > 0) return v;
    return Number(fornecedor.pedido_minimo_valor) || 0;
  };

  // Helper para parsear fotos do produto (vem como JSON string do banco)
  const getPrimeiraFoto = (item) => {
    try {
      if (!item.fotos) return null;
      const fotos = typeof item.fotos === 'string' ? JSON.parse(item.fotos) : item.fotos;
      return fotos && fotos.length > 0 ? fotos[0] : null;
    } catch (_e) {
      return null;
    }
  };

  const removerItem = (itemId, corSelecionada = null, isCapsula = false, tamanhoSelecionado = null) => {
    const novoCarrinho = carrinho.filter(item => {
      // Se é cápsula, apenas comparar o ID
      if (isCapsula || item.tipo === 'capsula') {
        return item.id !== itemId;
      }
      // Se tem tamanho, precisa bater id + tamanho
      if (tamanhoSelecionado) {
        return !(item.id === itemId && item.tamanho_selecionado === tamanhoSelecionado);
      }
      // Se não é cápsula, usar lógica antiga de produto
      if (corSelecionada) {
        return !(item.id === itemId && item.cor_selecionada?.cor_nome === corSelecionada.cor_nome);
      }
      return item.id !== itemId;
    });
    salvarCarrinho(novoCarrinho);
  };

  const atualizarQuantidade = (itemId, novaQuantidade, corSelecionada = null, isCapsula = false, tamanhoSelecionado = null) => {
    if (novaQuantidade <= 0) {
      removerItem(itemId, corSelecionada, isCapsula, tamanhoSelecionado);
      return;
    }

    const novoCarrinho = carrinho.map(item => {
      // Se é cápsula, apenas comparar o ID
      if (isCapsula || item.tipo === 'capsula') {
        return item.id === itemId ? { ...item, quantidade: novaQuantidade } : item;
      }

      // Match: por tamanho tem prioridade
      const match = tamanhoSelecionado
        ? item.id === itemId && item.tamanho_selecionado === tamanhoSelecionado
        : corSelecionada
        ? item.id === itemId && item.cor_selecionada?.cor_nome === corSelecionada.cor_nome
        : item.id === itemId && !item.cor_selecionada;

      return match ? { ...item, quantidade: novaQuantidade } : item;
    });
    salvarCarrinho(novoCarrinho);
  };

  const limparCarrinho = () => {
    if (confirm('Deseja realmente limpar todo o carrinho?')) {
      salvarCarrinho([]);
    }
  };

  // Helpers do mínimo da cápsula. Quando `minimos_quantidades` nao existe
  // (capsulas adicionadas antes do fix de 03/06), trata como minimo 0 —
  // jamais cai em `produtos_quantidades` como fallback, porque esse campo
  // reflete o ESTADO ATUAL ajustado pelo cliente, e usa-lo como minimo
  // travava qualquer tentativa de diminuir/desmarcar.
  const getCapsulaMin = (item, produtoId, corId) => {
    const mins = item.minimos_quantidades || {};
    const c = mins[produtoId];
    if (c === undefined || c === null) return 0;
    if (typeof c === 'number') return c;
    if (Array.isArray(c.variantes)) {
      const v = c.variantes.find(x => x.cor_id === corId);
      return v?.quantidade || 0;
    }
    return 0;
  };

  // Ajusta a quantidade de uma cor/produto dentro de uma cápsula no carrinho,
  // travando no mínimo configurado. Recalcula `preco_unitario` e `preco_total`.
  const ajustarQtdCapsulaCart = (itemId, produtoId, corId, delta) => {
    const novoCarrinho = carrinho.map(item => {
      if (item.id !== itemId || item.tipo !== 'capsula') return item;

      const pq = { ...(item.produtos_quantidades || {}) };
      const c = pq[produtoId];
      if (c === undefined || c === null) return item;

      const min = getCapsulaMin(item, produtoId, corId);

      if (typeof c === 'number') {
        const novo = Math.max(min, c + delta);
        pq[produtoId] = novo;
      } else if (Array.isArray(c.variantes)) {
        pq[produtoId] = {
          ...c,
          variantes: c.variantes.map(v => v.cor_id === corId
            ? { ...v, quantidade: Math.max(min, (v.quantidade || 0) + delta) }
            : v)
        };
      } else {
        return item;
      }

      // Sincroniza detalhes_produtos (espelho usado pela renderizacao)
      const novosDetalhes = (item.detalhes_produtos || []).map(det => {
        if (det.id !== produtoId) return det;
        const novaConfig = pq[produtoId];
        if (typeof novaConfig === 'number') {
          return { ...det, configuracao: novaConfig };
        }
        if (det.configuracao && Array.isArray(det.configuracao.variantes)) {
          return {
            ...det,
            configuracao: {
              ...det.configuracao,
              variantes: det.configuracao.variantes.map(v => v.cor_id === corId
                ? { ...v, quantidade: Math.max(min, (v.quantidade || 0) + delta) }
                : v)
            }
          };
        }
        return { ...det, configuracao: novaConfig };
      });

      // Recalcula preco unitario com base em produtos atuais do banco
      let precoUnitario = 0;
      for (const pid of (item.produto_ids || [])) {
        const produto = produtos.find(p => p.id === pid);
        if (!produto) continue;
        const qtdConf = pq[pid];
        const precoItem = produto.tipo_venda === 'grade'
          ? getPrecoGrade(produto, user)
          : getPrecoPeca(produto, user);
        if (typeof qtdConf === 'number') {
          precoUnitario += precoItem * qtdConf;
        } else if (qtdConf && Array.isArray(qtdConf.variantes)) {
          qtdConf.variantes.forEach(v => { precoUnitario += precoItem * (v.quantidade || 0); });
        }
      }

      return {
        ...item,
        produtos_quantidades: pq,
        detalhes_produtos: novosDetalhes,
        preco_unitario: precoUnitario,
        preco_total: precoUnitario * (item.quantidade || 1),
      };
    });
    salvarCarrinho(novoCarrinho);
  };

  // Verificar quais itens do carrinho estão indisponíveis (produto excluído ou desativado)
  const getItensIndisponiveis = () => {
    if (produtos.length === 0) return new Set();
    const indisponiveis = new Set();
    carrinho.forEach(item => {
      if (item.tipo === 'capsula') return; // cápsulas tratadas separadamente
      const produtoAtual = produtos.find(p => p.id === item.id);
      if (!produtoAtual || produtoAtual.ativo === false) {
        const itemKey = `${item.id}_${item.cor_selecionada?.cor_nome || 'default'}`;
        indisponiveis.add(itemKey);
      }
    });
    return indisponiveis;
  };

  const itensIndisponiveis = getItensIndisponiveis();
  const temIndisponivel = itensIndisponiveis.size > 0;

  const agruparPorFornecedor = () => {
    const grupos = {};
    carrinho.forEach(item => {
      let fornecedorKey;

      if (item.tipo === 'capsula') {
        // Para cápsulas, verificar de qual fornecedor são os produtos
        // Buscar o fornecedor do primeiro produto da cápsula
        const produtoIds = item.produto_ids || [];
        let fornecedorCapsula = null;

        // Buscar nos produtos carregados qual é o fornecedor
        if (produtoIds.length > 0 && produtos.length > 0) {
          const primeiroProduto = produtos.find(p => produtoIds.includes(p.id));
          if (primeiroProduto) {
            fornecedorCapsula = primeiroProduto.fornecedor_id;
          }
        }

        // Se não encontrou nos produtos carregados, tentar buscar nos detalhes
        if (!fornecedorCapsula && item.detalhes_produtos && item.detalhes_produtos.length > 0) {
          const detalhe = item.detalhes_produtos[0];
          if (detalhe.id && produtos.length > 0) {
            const prod = produtos.find(p => p.id === detalhe.id);
            if (prod) {
              fornecedorCapsula = prod.fornecedor_id;
            }
          }
        }

        // Usar o fornecedor encontrado ou 'capsula' como fallback
        fornecedorKey = fornecedorCapsula || 'capsula';
      } else {
        fornecedorKey = item.fornecedor_id;
      }

      if (!grupos[fornecedorKey]) {
        grupos[fornecedorKey] = {
          fornecedor_id: fornecedorKey,
          itens: [],
          total: 0,
          temCapsula: false
        };
      }

      if (item.tipo === 'capsula') {
        grupos[fornecedorKey].temCapsula = true;
      }

      grupos[fornecedorKey].itens.push(item);

      // Calcular preço do item (respeitando perfil do cliente)
      let preco;
      if (item.tipo === 'capsula') {
        preco = item.preco_unitario || 0;
      } else {
        preco = item.tipo_venda === 'grade'
          ? getPrecoGrade(item, user)
          : getPrecoPeca(item, user);
      }

      grupos[fornecedorKey].total += preco * item.quantidade;
    });
    return Object.values(grupos);
  };

  const getMetodosPagamentoDisponiveis = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);

    // Monta a label do boleto faturado a partir dos prazos cadastrados do fornecedor
    const prazosBoleto = Array.isArray(fornecedor?.boleto_faturado_prazos_dias)
      ? fornecedor.boleto_faturado_prazos_dias
      : [];
    const labelBoletoFaturado = prazosBoleto.length > 0
      ? `Boleto Faturado (${prazosBoleto.join('/')} dias)`
      : 'Boleto Faturado (30 dias)';

    // Multimarca: somente à vista (sem boleto)
    let metodosBase;
    if (user?.tipo_negocio === 'multimarca') {
      metodosBase = [
        { value: 'pix', label: 'PIX' },
        { value: 'cartao_credito', label: 'Cartão de Crédito' },
        { value: 'transferencia', label: 'Transferência Bancária' }
      ];
    } else {
      // Verifica se o cliente está na lista de "sem crédito" (bloqueado para boleto)
      const clienteBloqueado = fornecedor &&
        fornecedor.clientes_boleto_faturado &&
        user &&
        fornecedor.clientes_boleto_faturado.includes(user.id);

      if (clienteBloqueado) {
        // Cliente sem crédito - apenas PIX e Cartão
        metodosBase = [
          { value: 'pix', label: 'PIX' },
          { value: 'cartao_credito', label: 'Cartão de Crédito' }
        ];
      } else {
        // Cliente com crédito - todas as opções de pagamento
        metodosBase = [
          { value: 'pix', label: 'PIX' },
          { value: 'cartao_credito', label: 'Cartão de Crédito' },
          { value: 'boleto_faturado', label: labelBoletoFaturado },
          { value: 'transferencia', label: 'Transferência Bancária' }
        ];
      }
    }

    // Intersecção com os métodos que o fornecedor aceita.
    // Se o fornecedor não tem a lista preenchida (registros antigos), aceita todos.
    const aceitosPeloFornecedor = Array.isArray(fornecedor?.metodos_pagamento_aceitos)
      ? fornecedor.metodos_pagamento_aceitos
      : ['pix', 'cartao_credito', 'boleto_faturado', 'transferencia'];

    return metodosBase.filter(m => aceitosPeloFornecedor.includes(m.value));
  };

  // Função reutilizável para criar um pedido para uma loja específica
  const criarPedidoParaLoja = async (grupoData, loja, metodo, obs) => {
    try {
      // Validar endereço da loja
      const enderecoSource = loja || user;
      if (!enderecoSource.endereco_completo || !enderecoSource.cep || !enderecoSource.cidade || !enderecoSource.estado) {
        const msg = loja
          ? `Loja "${loja.nome_fantasia || loja.nome}" não possui endereço completo.`
          : 'Endereço de entrega incompleto.';
        return { success: false, error: msg };
      }

      // Verificar inadimplência por loja
      if (user.tipo_negocio === 'multimarca' || user.tipo_negocio === 'franqueado') {
        const filtroCarteira = { cliente_user_id: user.id };
        if (loja) filtroCarteira.loja_id = loja.id;
        const titulosCliente = await Carteira.filter(filtroCarteira);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const titulosVencidos = (titulosCliente || []).filter(t => {
          if (t.status !== 'pendente') return false;
          if (!t.data_vencimento) return false;
          if (!t.parcela_numero) return false; // ignora placeholders sem parcela real
          const dv = new Date(t.data_vencimento + 'T00:00:00');
          return dv < hoje;
        });

        const totalVencido = titulosVencidos.reduce((sum, t) => sum + (t.valor || 0), 0);
        if (titulosVencidos.length > 0 && totalVencido > 0) {
          return { success: false, error: `Loja "${loja?.nome_fantasia || loja?.nome || 'Conta'}" possui títulos vencidos (${formatCurrency(totalVencido)}).` };
        }
      }

      // Verificar pedido mínimo
      const fornecedor = fornecedores.find(f => f.id === grupoData.fornecedor_id);
      if (fornecedor && getMinimoFornecedor(fornecedor) > 0) {
        if (grupoData.total < getMinimoFornecedor(fornecedor)) {
          return { success: false, error: `Valor abaixo do mínimo de ${formatCurrency(getMinimoFornecedor(fornecedor))}.` };
        }
      }

      // Mapear itens - expandir cápsulas em produtos individuais
      const itensPedido = grupoData.itens.flatMap(item => {
        if (item.tipo === 'capsula') {
          // Expandir cápsula em produtos individuais
          const detalhes = item.detalhes_produtos || [];
          const capsulaQtd = item.quantidade || 1;

          return detalhes.flatMap(detalhe => {
            const produtoCompleto = produtos.find(p => p.id === detalhe.id);
            if (!produtoCompleto) return [];

            const config = detalhe.configuracao;
            const tipoVenda = produtoCompleto.tipo_venda || 'avulso';
            const pecasGrade = parseInt(produtoCompleto.total_pecas_grade) || 1;
            const precoUnitario = getPrecoPeca(produtoCompleto, user);
            const precoGrade = getPrecoGrade(produtoCompleto, user);

            // Foto do produto
            let fotoUrl = null;
            if (detalhe.foto) {
              fotoUrl = typeof detalhe.foto === 'string' ? detalhe.foto : detalhe.foto?.url;
            }
            if (!fotoUrl) {
              fotoUrl = getPrimeiraFoto(produtoCompleto);
            }

            // Quando o produto eh vendido em grade, o pedido guarda:
            //   quantidade = num. de GRADES (nao pecas)
            //   preco      = preco da GRADE inteira (= preco_grade_completa)
            // Quando eh avulso, guarda peca: quantidade = pecas, preco = por peca.
            // (mesmo padrao do checkout de produto normal, linhas ~537-540)
            const isGrade = tipoVenda === 'grade';

            // Se tem variantes por cor, criar um item por cor.
            // IMPORTANTE: variantes com quantidade 0 sao IGNORADAS (cliente
            // viu a cor disponivel mas optou por nao pedir).
            if (config && typeof config === 'object' && config.variantes && Array.isArray(config.variantes)) {
              return config.variantes
                .map(variante => {
                  const numGrades = (Number(variante.quantidade) || 0) * capsulaQtd;
                  if (numGrades <= 0) return null; // pula cor zerada
                  const precoSalvo = isGrade ? precoGrade : precoUnitario;
                  return {
                    produto_id: detalhe.id,
                    nome: produtoCompleto.nome,
                    marca: produtoCompleto.marca || '',
                    referencia: produtoCompleto.referencia_polo || produtoCompleto.referencia_fornecedor || '',
                    referencia_fornecedor: produtoCompleto.referencia_fornecedor || '',
                    referencia_linx: produtoCompleto.referencia_polo || '',
                    tipo_venda: tipoVenda,
                    quantidade: numGrades,
                    total_pecas_grade: pecasGrade,
                    preco: precoSalvo,
                    total: precoSalvo * numGrades,
                    foto: fotoUrl,
                    grade_selecionada: null,
                    cor_selecionada: {
                      cor_nome: variante.cor_nome,
                      cor_codigo_hex: variante.cor_codigo_hex || variante.cor_hex || '#000000'
                    },
                    origem_capsula: item.capsula_id
                  };
                })
                .filter(Boolean);
            }

            // Produto por tamanho na capsula: gera 1 item por tamanho.
            // Quantidade eh em PECAS. Se grade, preco = preco_grade / total_pecas_grade.
            if (config && typeof config === 'object' && Array.isArray(config.tamanhos)) {
              const precoPorPecaTam = isGrade && pecasGrade > 0
                ? (precoGrade / pecasGrade)
                : precoUnitario;
              return config.tamanhos
                .map(tamConfig => {
                  const qtdPecas = (Number(tamConfig.quantidade) || 0) * capsulaQtd;
                  if (qtdPecas <= 0) return null;
                  return {
                    produto_id: detalhe.id,
                    nome: produtoCompleto.nome,
                    marca: produtoCompleto.marca || '',
                    referencia: produtoCompleto.referencia_polo || produtoCompleto.referencia_fornecedor || '',
                    referencia_fornecedor: produtoCompleto.referencia_fornecedor || '',
                    referencia_linx: produtoCompleto.referencia_polo || '',
                    tipo_venda: tipoVenda,
                    quantidade: qtdPecas,
                    total_pecas_grade: pecasGrade,
                    preco: precoPorPecaTam,
                    total: precoPorPecaTam * qtdPecas,
                    foto: fotoUrl,
                    grade_selecionada: null,
                    cor_selecionada: null,
                    tamanho_selecionado: tamConfig.tamanho,
                    origem_capsula: item.capsula_id
                  };
                })
                .filter(Boolean);
            }

            // Quantidade simples (sem variantes de cor)
            const qtdSimples = (typeof config === 'number' ? config : 0) * capsulaQtd;
            if (qtdSimples <= 0) return []; // produto opcional nao pedido
            const precoSimples = isGrade ? precoGrade : precoUnitario;
            return [{
              produto_id: detalhe.id,
              nome: produtoCompleto.nome,
              marca: produtoCompleto.marca || '',
              referencia: produtoCompleto.referencia_polo || produtoCompleto.referencia_fornecedor || '',
              referencia_fornecedor: produtoCompleto.referencia_fornecedor || '',
              referencia_linx: produtoCompleto.referencia_polo || '',
              tipo_venda: tipoVenda,
              quantidade: qtdSimples,
              total_pecas_grade: pecasGrade,
              preco: precoSimples,
              total: precoSimples * qtdSimples,
              foto: fotoUrl,
              grade_selecionada: null,
              cor_selecionada: null,
              origem_capsula: item.capsula_id
            }];
          });
        }
        // Produto por tamanho: quantidade eh sempre em PECAS. Se for grade,
        // o preco por peca vem da grade dividida (grade R$120 / 6 pcs = R$20).
        const isPorTamanho = !!item.tamanho_selecionado;
        let precoBase;
        if (isPorTamanho) {
          if (item.tipo_venda === 'grade' && (item.total_pecas_grade || 0) > 0) {
            precoBase = getPrecoGrade(item, user) / item.total_pecas_grade;
          } else {
            precoBase = getPrecoPeca(item, user);
          }
        } else {
          precoBase = item.tipo_venda === 'grade' ? getPrecoGrade(item, user) : getPrecoPeca(item, user);
        }
        return [{
          produto_id: item.id,
          nome: item.nome,
          marca: item.marca,
          referencia: item.referencia_polo || item.referencia_fornecedor || '',
          referencia_fornecedor: item.referencia_fornecedor || '',
          referencia_linx: item.referencia_polo || '',
          tipo_venda: item.tipo_venda,
          quantidade: item.quantidade,
          total_pecas_grade: item.total_pecas_grade || 0,
          preco: precoBase,
          total: precoBase * item.quantidade,
          foto: getPrimeiraFoto(item),
          grade_selecionada: item.grade_configuracao || null,
          cor_selecionada: item.cor_selecionada || null,
          tamanho_selecionado: item.tamanho_selecionado || null,
        }];
      });

      // Calcular total com base nos itens (pode ter sido editado no modal)
      const totalCalculado = itensPedido.reduce((sum, it) => sum + it.total, 0);

      // Endereço de entrega. `user` aqui e o COMPRADOR — nunca o vendedor.
      // Para o vendedor a loja e obrigatoria (exigeLoja), senao o pedido cairia
      // no endereco de quem operou a tela.
      const src = loja || user;
      const enderecoEntrega = {
        endereco: src.endereco_completo,
        cep: src.cep,
        cidade: src.cidade,
        estado: src.estado,
        destinatario: loja ? (loja.nome_fantasia || loja.nome) : user.full_name,
        telefone: loja?.telefone || user.telefone || user.whatsapp
      };

      const fornecedorId = grupoData.fornecedor_id;
      const pedidoData = {
        comprador_user_id: user.id,
        fornecedor_id: fornecedorId === 'capsula' ? null : fornecedorId,
        loja_id: loja?.id || null,
        itens: itensPedido,
        valor_total: totalCalculado,
        valor_final: totalCalculado,
        status: 'novo_pedido',
        status_pagamento: 'pendente',
        metodo_pagamento: metodo,
        endereco_entrega: enderecoEntrega,
        observacoes: obs || '',
        observacoes_comprador: obs || '',
        estoque_baixado: true,
        // Autoria: quem operou a tela (o cliente, ou o vendedor em nome dele).
        criado_por_user_id: usuarioLogado?.id || null,
        criado_por_papel: isVendedor ? 'vendedor' : 'cliente',
      };

      const pedido = await Pedido.create(pedidoData);

      // Baixa automática de estoque dos produtos vendidos.
      // Não bloqueia o pedido caso falhe — apenas registra o erro.
      try {
        await darBaixaEstoque(itensPedido);
      } catch (estoqueErr) {
        console.error('Erro ao dar baixa no estoque:', estoqueErr);
      }

      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const descricaoCarteira = fornecedorId === 'capsula'
        ? `Pedido #${pedido.id.slice(-8).toUpperCase()} - Cápsula`
        : `Pedido #${pedido.id.slice(-8).toUpperCase()} - ${fornecedor?.nome_fantasia || fornecedor?.nome_marca}`;

      await Carteira.create({
        pedido_id: pedido.id,
        cliente_user_id: user.id,
        loja_id: loja?.id || null,
        tipo: 'a_pagar',
        descricao: descricaoCarteira,
        valor: totalCalculado,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        status: 'pendente',
        categoria: 'Pedido'
      });

      return { success: true, pedidoId: pedido.id };
    } catch (err) {
      console.error('Erro ao criar pedido para loja:', err);
      return { success: false, error: err.message || 'Erro desconhecido ao criar pedido.' };
    }
  };

  // Helper para remover itens de um fornecedor do carrinho
  const removerItensFornecedorDoCarrinho = (fornecedorId) => {
    return carrinho.filter(item => {
      if (item.tipo === 'capsula') {
        const produtoIds = item.produto_ids || [];
        let fornecedorCapsula = null;
        if (produtoIds.length > 0 && produtos.length > 0) {
          const primeiroProduto = produtos.find(p => produtoIds.includes(p.id));
          if (primeiroProduto) fornecedorCapsula = primeiroProduto.fornecedor_id;
        }
        if (!fornecedorCapsula && item.detalhes_produtos && item.detalhes_produtos.length > 0) {
          const detalhe = item.detalhes_produtos[0];
          if (detalhe.id && produtos.length > 0) {
            const prod = produtos.find(p => p.id === detalhe.id);
            if (prod) fornecedorCapsula = prod.fornecedor_id;
          }
        }
        return fornecedorCapsula !== fornecedorId;
      }
      return item.fornecedor_id !== fornecedorId;
    });
  };

  const handleReplicarSuccess = (fornecedorId) => {
    // Limpar carrinho deste fornecedor após replicação bem-sucedida
    const novoCarrinho = removerItensFornecedorDoCarrinho(fornecedorId);
    salvarCarrinho(novoCarrinho);
    if (novoCarrinho.length === 0) {
      navigate(createPageUrl('MeusPedidos'));
    }
  };

  // Toggle a single loja selection for a specific supplier group
  const toggleLojaForGroup = (fornecedorId, lojaId) => {
    setSelectedLojasMap(prev => {
      const current = new Set(prev[fornecedorId] || []);
      if (current.has(lojaId)) {
        current.delete(lojaId);
      } else {
        current.add(lojaId);
      }
      return { ...prev, [fornecedorId]: current };
    });
  };

  const getSelectedLojasForGroup = (fornecedorId) => {
    return selectedLojasMap[fornecedorId] || new Set();
  };

  // Open multi-store modal for a supplier group
  const abrirMultiLojaModal = (grupo, selectedIds) => {
    setReplicarGrupo(grupo);
    setReplicarPreSelectedIds(Array.from(selectedIds));
    setReplicarModalOpen(true);
  };

  const finalizarCompraPorFornecedor = async (fornecedorId) => {
    // Vendedor sem cliente escolhido nao tem em nome de quem comprar.
    if (!user) {
      toast.error('Escolha o cliente no topo da tela antes de finalizar o pedido.');
      return;
    }

    // Determine which loja to use
    const selectedIds = getSelectedLojasForGroup(fornecedorId);
    const targetLoja = selectedIds.size === 1
      ? lojas.find(l => l.id === Array.from(selectedIds)[0]) || null
      : null; // No lojas = legacy (user address)

    // Sem loja, o endereco cai no cadastro do comprador. Isso e legado e so vale
    // para cliente sem loja — um vendedor PRECISA escolher a loja de entrega.
    if (exigeLoja && !targetLoja) {
      toast.info('Selecione a loja de entrega do cliente para finalizar o pedido.');
      return;
    }

    // Validate address source
    const enderecoSource = targetLoja || user;
    if (!enderecoSource.endereco_completo || !enderecoSource.cep || !enderecoSource.cidade || !enderecoSource.estado) {
      const msg = targetLoja
        ? `Complete o endereço da loja "${targetLoja.nome_fantasia || targetLoja.nome}" para finalizar.`
        : 'Por favor, cadastre seu endereço de entrega completo no seu perfil antes de finalizar o pedido.';
      toast.info(msg);
      return;
    }

    if (!metodoPagamento[fornecedorId]) {
      toast.info('Por favor, selecione um método de pagamento para este fornecedor.');
      return;
    }

    // Defesa em profundidade: garantir que o método escolhido está realmente entre os aceitos pelo fornecedor
    const metodosDisponiveis = getMetodosPagamentoDisponiveis(fornecedorId).map(m => m.value);
    if (!metodosDisponiveis.includes(metodoPagamento[fornecedorId])) {
      toast.error('Este método de pagamento não é aceito por este fornecedor. Escolha outra opção.');
      return;
    }

    if (user.bloqueado) {
      toast.error(`Sua conta está bloqueada. ${user.motivo_bloqueio ? `Motivo: ${user.motivo_bloqueio}.` : ''} Regularize seus pagamentos para fazer novos pedidos.`);
      return;
    }

    // Verificar bloqueio da loja em tempo real
    if (targetLoja) {
      try {
        const freshLoja = await Loja.get(targetLoja.id);
        if (freshLoja.bloqueada) {
          toast.error(`A loja "${freshLoja.nome_fantasia || freshLoja.nome}" está bloqueada. ${freshLoja.motivo_bloqueio ? `Motivo: ${freshLoja.motivo_bloqueio}.` : ''} Regularize a situação para fazer pedidos.`);
          return;
        }
      } catch (e) {
        console.warn('Erro ao verificar bloqueio da loja:', e);
      }
    }

    // Verificação em tempo real de inadimplência antes de finalizar
    if (user.tipo_negocio === 'multimarca' || user.tipo_negocio === 'franqueado') {
      try {
        // Sempre o COMPRADOR. Com um vendedor operando, User.me() traria o
        // vendedor — e o checkout checaria o bloqueio da pessoa errada.
        const freshUser = isVendedor ? await User.get(user.id) : await User.me();
        if (freshUser.bloqueado) {
          if (!isVendedor) setUsuarioLogado(freshUser);
          toast.error(
            isVendedor
              ? `A conta de ${freshUser.empresa || freshUser.full_name} está bloqueada. ${freshUser.motivo_bloqueio ? `Motivo: ${freshUser.motivo_bloqueio}.` : ''}`
              : `Sua conta está bloqueada. ${freshUser.motivo_bloqueio ? `Motivo: ${freshUser.motivo_bloqueio}.` : ''} Regularize seus pagamentos para fazer novos pedidos.`
          );
          return;
        }

        const filtroCarteira = { cliente_user_id: freshUser.id };
        if (targetLoja) {
          filtroCarteira.loja_id = targetLoja.id;
        }
        const titulosCliente = await Carteira.filter(filtroCarteira);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const titulosVencidos = (titulosCliente || []).filter(t => {
          if (t.status !== 'pendente') return false;
          if (!t.data_vencimento) return false;
          if (!t.parcela_numero) return false; // ignora placeholders sem parcela real
          const dv = new Date(t.data_vencimento + 'T00:00:00');
          return dv < hoje;
        });

        const totalVencido = titulosVencidos.reduce((sum, t) => sum + (t.valor || 0), 0);

        if (titulosVencidos.length > 0 && totalVencido > 0) {
          // Em todos os caminhos o checkout e barrado. A diferenca e so se a
          // conta tambem passa a ficar bloqueada — e isso o vendedor nao faz.
          if (!targetLoja && !isVendedor) {
            await User.update(freshUser.id, {
              bloqueado: true,
              motivo_bloqueio: `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`,
              data_bloqueio: new Date().toISOString(),
              total_vencido: totalVencido
            });
            freshUser.bloqueado = true;
            freshUser.motivo_bloqueio = `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`;
            setUsuarioLogado({ ...freshUser });
          }
          setDadosInadimplencia({ titulosVencidos, totalVencido });
          setShowBloqueioModal(true);
          return;
        }
      } catch (e) {
        console.warn('Erro na verificação em tempo real de inadimplência:', e);
      }
    }

    setFinalizando(prev => ({ ...prev, [fornecedorId]: true }));

    try {
      const grupo = agruparPorFornecedor().find(g => g.fornecedor_id === fornecedorId);
      if (!grupo) {
        throw new Error('Grupo de fornecedor não encontrado');
      }

      const fornecedor = fornecedores.find(f => f.id === fornecedorId);
      if (fornecedor && getMinimoFornecedor(fornecedor) > 0) {
        if (grupo.total < getMinimoFornecedor(fornecedor)) {
          toast.error(
            `O pedido para ${fornecedor.nome_marca} não atingiu o valor mínimo de ${formatCurrency(getMinimoFornecedor(fornecedor))}. ` +
            `Valor atual: ${formatCurrency(grupo.total)}`
          );
          setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
          return;
        }
      }

      const result = await criarPedidoParaLoja(
        grupo,
        targetLoja,
        metodoPagamento[fornecedorId],
        observacoes[fornecedorId] || ''
      );

      if (!result.success) {
        toast.error(result.error || 'Erro ao processar o pedido.');
        setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
        return;
      }

      const novoCarrinho = removerItensFornecedorDoCarrinho(fornecedorId);
      salvarCarrinho(novoCarrinho);

      const fornecedorNome = fornecedor?.nome_marca || 'Fornecedor';
      const numeroPedido = result.pedidoId ? `#${result.pedidoId.slice(-8).toUpperCase()}` : '';
      if (grupo.temCapsula) {
        toast.success(`Pedido ${numeroPedido} para ${fornecedorNome} (incluindo cápsula) criado com sucesso!`);
      } else {
        toast.success(`Pedido ${numeroPedido} para ${fornecedorNome} criado com sucesso!`);
      }

      if (novoCarrinho.length === 0) {
        navigate(createPageUrl('MeusPedidos'));
      }
    } catch (_error) {
      toast.error('Erro ao processar o pedido. Tente novamente.');
    } finally {
      setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const grupos = agruparPorFornecedor();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => navigate(createPageUrl('Catalogo'))}
              className="mb-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continuar Comprando
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8" />
              Meu Carrinho
            </h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              {carrinho.length} {carrinho.length === 1 ? 'item' : 'itens'} no carrinho
            </p>
          </div>

          {carrinho.length > 0 && (
            <Button variant="outline" onClick={limparCarrinho} className="w-full sm:w-auto">
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Carrinho
            </Button>
          )}
        </div>

        {carrinho.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
              <ShoppingCart className="w-20 h-20 sm:w-24 sm:h-24 text-gray-400 mb-4" />
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2 text-center">
                Seu carrinho está vazio
              </h2>
              <p className="text-gray-600 mb-6 text-center text-sm sm:text-base">
                Adicione produtos do catálogo para começar a comprar
              </p>
              <Button onClick={() => navigate(createPageUrl('Catalogo'))} className="bg-blue-600">
                <Package className="w-4 h-4 mr-2" />
                Ir para o Catálogo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Alerta de bloqueio global */}
            {user?.bloqueado && (
              <Alert className="bg-red-50 border-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm sm:text-base">
                  <strong>Conta bloqueada.</strong> {user.motivo_bloqueio ? `Motivo: ${user.motivo_bloqueio}.` : ''} Regularize seus pagamentos para fazer novos pedidos.
                </AlertDescription>
              </Alert>
            )}


            {/* Alerta de produtos indisponíveis */}
            {temIndisponivel && (
              <Alert className="bg-red-50 border-red-300">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm sm:text-base">
                  <strong>Atenção:</strong> Alguns produtos no seu carrinho não estão mais disponíveis. Remova-os para poder finalizar a compra.
                </AlertDescription>
              </Alert>
            )}

            {/* Alerta sobre endereço (apenas para users sem lojas) */}
            {hasNoLojas && (() => {
              const semEndereco = !user?.endereco_completo || !user?.cep || !user?.cidade || !user?.estado;
              if (!semEndereco) return null;
              return (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-sm sm:text-base">
                    <strong>Atenção:</strong> Você precisa cadastrar seu endereço de entrega completo no seu perfil antes de finalizar os pedidos.
                  </AlertDescription>
                </Alert>
              );
            })()}

            {/* Lista de Produtos por Fornecedor */}
            {grupos.map((grupo) => {
              const fornecedor = fornecedores.find(f => f.id === grupo.fornecedor_id);
              const valorMinimo = getMinimoFornecedor(fornecedor);
              const atingiuMinimo = grupo.total >= valorMinimo;
              const metodosPagamento = getMetodosPagamentoDisponiveis(grupo.fornecedor_id);
              const selectedLojas = getSelectedLojasForGroup(grupo.fornecedor_id);
              const selectedCount = selectedLojas.size;
              const lojasAtivas = lojas.filter(l => l.ativa !== false && !l.bloqueada);

              // Determine endereco source based on selection
              const singleSelectedLoja = selectedCount === 1
                ? lojas.find(l => l.id === Array.from(selectedLojas)[0])
                : null;
              const enderecoSource = singleSelectedLoja || (hasNoLojas ? user : null);
              const enderecoIncompleto = enderecoSource
                ? !enderecoSource.endereco_completo || !enderecoSource.cep || !enderecoSource.cidade || !enderecoSource.estado
                : selectedCount === 0 && !hasNoLojas; // No store selected = incomplete

              return (
                <Card key={grupo.fornecedor_id} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        <span className="text-lg sm:text-xl">{fornecedor?.razao_social || fornecedor?.nome_fantasia || 'Fornecedor'}</span>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
                      </Badge>
                    </CardTitle>
                    {valorMinimo > 0 && (
                      <Alert className={`mt-3 ${atingiuMinimo ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                        {atingiuMinimo ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        <AlertDescription className={`text-sm ${atingiuMinimo ? 'text-green-800' : 'text-yellow-800'}`}>
                          {atingiuMinimo ? (
                            `Valor mínimo atingido (${formatCurrency(valorMinimo)})`
                          ) : (
                            `Valor mínimo: ${formatCurrency(valorMinimo)} (Faltam ${formatCurrency(valorMinimo - grupo.total)})`
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    {/* Produtos ou Cápsulas */}
                    <div className="space-y-4">
                      {grupo.itens.map((item, itemIndex) => {
                        // Renderização especial para cápsulas
                        if (item.tipo === 'capsula') {
                          return (
                            <div key={item.id} className="border-2 border-purple-300 bg-purple-50 rounded-lg p-4">
                              <div className="flex flex-col sm:flex-row gap-4">
                                {item.imagem_capa_url ? (
                                  <img
                                    src={item.imagem_capa_url}
                                    alt={item.nome}
                                    className="w-full sm:w-24 h-48 sm:h-24 object-cover rounded-md"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full sm:w-24 h-48 sm:h-24 bg-gray-200 rounded-md flex items-center justify-center">
                                    <Package className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}

                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-purple-600 text-white">CÁPSULA</Badge>
                                    <h3 className="font-bold text-lg">{item.nome}</h3>
                                  </div>
                                  {item.descricao && (
                                    <p className="text-sm text-gray-700 mb-2">{item.descricao}</p>
                                  )}
                                  <p className="text-sm text-gray-600">
                                    {item.detalhes_produtos?.length || item.produto_ids?.length || 0} produtos inclusos
                                  </p>

                                  {/* Botão Ver Produtos */}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 text-purple-700 border-purple-300 hover:bg-purple-50"
                                    onClick={() => setCapsulaProdutosExpandidos(prev => ({
                                      ...prev,
                                      [item.id]: !prev[item.id]
                                    }))}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                    {capsulaProdutosExpandidos[item.id] ? 'Ocultar Produtos' : 'Ver Produtos'}
                                    {capsulaProdutosExpandidos[item.id]
                                      ? <ChevronUp className="w-3.5 h-3.5 ml-1" />
                                      : <ChevronDown className="w-3.5 h-3.5 ml-1" />
                                    }
                                  </Button>

                                  {/* Lista de Produtos Expandida */}
                                  {capsulaProdutosExpandidos[item.id] && (() => {
                                    // Usar detalhes_produtos se disponível, senão construir a partir de produto_ids
                                    let listaDetalhes = item.detalhes_produtos && item.detalhes_produtos.length > 0
                                      ? item.detalhes_produtos
                                      : (item.produto_ids || []).map(pid => {
                                          const prod = produtos.find(p => p.id === pid);
                                          return prod ? { id: pid, nome: prod.nome, foto: null, configuracao: null } : { id: pid, nome: 'Produto', foto: null, configuracao: null };
                                        });

                                    if (listaDetalhes.length === 0) return null;

                                    return (
                                      <div className="mt-3 bg-white rounded-lg border border-purple-200 divide-y divide-purple-100">
                                        {listaDetalhes.map((detalhe, dIdx) => {
                                          const produtoCompleto = produtos.find(p => p.id === detalhe.id);
                                          const config = detalhe.configuracao;
                                          const isVariantes = config && typeof config === 'object' && config.variantes;
                                          const qtdSimples = typeof config === 'number' ? config : null;

                                          // Foto do produto - múltiplas tentativas
                                          let fotoUrl = null;
                                          if (detalhe.foto) {
                                            fotoUrl = typeof detalhe.foto === 'string' ? detalhe.foto : detalhe.foto?.url;
                                          }
                                          if (!fotoUrl && produtoCompleto) {
                                            try {
                                              const fotos = typeof produtoCompleto.fotos === 'string' ? JSON.parse(produtoCompleto.fotos) : produtoCompleto.fotos;
                                              if (fotos && fotos.length > 0) {
                                                fotoUrl = typeof fotos[0] === 'string' ? fotos[0] : fotos[0]?.url;
                                              }
                                            } catch {}
                                          }

                                          return (
                                            <div key={dIdx} className="flex items-center gap-3 p-3">
                                              {fotoUrl ? (
                                                <img src={fotoUrl} alt={detalhe.nome} className="w-12 h-12 object-cover rounded flex-shrink-0" onError={e => e.target.style.display = 'none'} />
                                              ) : (
                                                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                                  <Package className="w-5 h-5 text-gray-400" />
                                                </div>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{detalhe.nome || produtoCompleto?.nome || 'Produto'}</p>
                                                {produtoCompleto && (
                                                  <p className="text-xs text-gray-500">
                                                    {produtoCompleto.marca}
                                                    {produtoCompleto.referencia_polo ? ` - Ref: ${produtoCompleto.referencia_polo}` : ''}
                                                  </p>
                                                )}
                                                {/* Variantes por cor com +/- (trava no minimo) */}
                                                {isVariantes && config.variantes.length > 0 && (
                                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {config.variantes.map((v, vIdx) => {
                                                      const min = getCapsulaMin(item, detalhe.id, v.cor_id);
                                                      const podeDecrementar = (v.quantidade || 0) > min;
                                                      return (
                                                        <span key={vIdx} className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 rounded pl-1.5 pr-0.5 py-0.5">
                                                          <span className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: v.cor_codigo_hex || v.cor_hex || '#000' }} />
                                                          <span>{v.cor_nome}:</span>
                                                          <button
                                                            type="button"
                                                            onClick={() => ajustarQtdCapsulaCart(item.id, detalhe.id, v.cor_id, -1)}
                                                            disabled={!podeDecrementar}
                                                            title={podeDecrementar ? 'Diminuir' : `Mínimo: ${min}`}
                                                            className="w-5 h-5 rounded border border-purple-300 bg-white flex items-center justify-center hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                                          >
                                                            <Minus className="w-3 h-3" />
                                                          </button>
                                                          <span className="font-semibold tabular-nums px-0.5">{v.quantidade}</span>
                                                          <button
                                                            type="button"
                                                            onClick={() => ajustarQtdCapsulaCart(item.id, detalhe.id, v.cor_id, +1)}
                                                            className="w-5 h-5 rounded border border-purple-300 bg-white flex items-center justify-center hover:bg-purple-100"
                                                          >
                                                            <Plus className="w-3 h-3" />
                                                          </button>
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                                {/* Quantidade simples com +/- (produto sem variantes) */}
                                                {qtdSimples !== null && (() => {
                                                  const min = getCapsulaMin(item, detalhe.id, null);
                                                  const podeDecrementar = qtdSimples > min;
                                                  return (
                                                    <div className="flex items-center gap-1 text-xs text-purple-700 mt-1">
                                                      <span>Qtd:</span>
                                                      <button
                                                        type="button"
                                                        onClick={() => ajustarQtdCapsulaCart(item.id, detalhe.id, null, -1)}
                                                        disabled={!podeDecrementar}
                                                        title={podeDecrementar ? 'Diminuir' : `Mínimo: ${min}`}
                                                        className="w-5 h-5 rounded border border-purple-300 bg-white flex items-center justify-center hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                                      >
                                                        <Minus className="w-3 h-3" />
                                                      </button>
                                                      <span className="font-semibold tabular-nums px-1">{qtdSimples}</span>
                                                      <button
                                                        type="button"
                                                        onClick={() => ajustarQtdCapsulaCart(item.id, detalhe.id, null, +1)}
                                                        className="w-5 h-5 rounded border border-purple-300 bg-white flex items-center justify-center hover:bg-purple-100"
                                                      >
                                                        <Plus className="w-3 h-3" />
                                                      </button>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}

                                  {/* Cores resumidas (quando fechado) */}
                                  {!capsulaProdutosExpandidos[item.id] && (() => {
                                    const coresComQuantidade = new Map();
                                    item.detalhes_produtos?.forEach(detalhe => {
                                      const config = detalhe.configuracao;
                                      if (config && typeof config === 'object' && config.variantes && Array.isArray(config.variantes)) {
                                        config.variantes.forEach(variante => {
                                          const corNome = variante.cor_nome;
                                          const corHex = variante.cor_codigo_hex || '#000000';
                                          const quantidade = variante.quantidade || 0;
                                          if (coresComQuantidade.has(corNome)) {
                                            coresComQuantidade.get(corNome).quantidade += quantidade;
                                          } else {
                                            coresComQuantidade.set(corNome, { hex: corHex, quantidade });
                                          }
                                        });
                                      }
                                    });
                                    if (coresComQuantidade.size > 0) {
                                      return (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {Array.from(coresComQuantidade.entries()).map(([corNome, dados], idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 text-xs bg-white border border-purple-200 rounded-full px-2 py-0.5">
                                              <span className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: dados.hex }} />
                                              {corNome} ({dados.quantidade})
                                            </span>
                                          ))}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}

                                  <p className="text-lg font-semibold text-purple-700 mt-2">
                                    {formatCurrency(item.preco_unitario)} por cápsula
                                  </p>
                                </div>

                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removerItem(item.id, null, true)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => atualizarQuantidade(item.id, item.quantidade - 1, null, true)}
                                    >
                                      <Minus className="w-4 h-4" />
                                    </Button>
                                    <span className="w-12 text-center font-semibold">{item.quantidade}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => atualizarQuantidade(item.id, item.quantidade + 1, null, true)}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </div>

                                  <p className="text-base font-bold text-purple-900">
                                    {formatCurrency(item.preco_unitario * item.quantidade)}
                                  </p>
                                  {/* Total de pecas da capsula = soma dos produtos x multiplicador. */}
                                  {(() => {
                                    const pecas = calcularPecasCapsula(item);
                                    if (pecas <= 0) return null;
                                    return (
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {pecas.toLocaleString('pt-BR')} {pecas === 1 ? 'peça' : 'peças'}
                                      </p>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Renderização normal para produtos
                        const preco = item.tipo_venda === 'grade'
                          ? getPrecoGrade(item, user)
                          : getPrecoPeca(item, user);
                        const itemKey = `${item.id}_${item.cor_selecionada?.cor_nome || 'default'}`;
                        const indisponivel = itensIndisponiveis.has(itemKey);

                        return (
                          <div key={itemKey} className={`flex flex-col sm:flex-row gap-4 p-4 rounded-lg ${indisponivel ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-50'}`}>
                            {indisponivel && (
                              <div className="sm:hidden flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
                                <XCircle className="w-4 h-4" />
                                Produto indisponível — remova do carrinho
                              </div>
                            )}
                            {getPrimeiraFoto(item) ? (
                              <img
                                src={getPrimeiraFoto(item)}
                                alt={item.nome}
                                className="w-full sm:w-24 h-48 sm:h-24 object-cover rounded-md"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full sm:w-24 h-48 sm:h-24 bg-gray-200 rounded-md flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}

                            <div className={`flex-1 min-w-0 ${indisponivel ? 'opacity-60' : ''}`}>
                              <h3 className="font-semibold text-base sm:text-lg text-gray-900 line-clamp-2">
                                {item.nome}
                              </h3>
                              {indisponivel && (
                                <div className="hidden sm:flex items-center gap-1 text-red-600 text-sm font-medium mt-1">
                                  <XCircle className="w-4 h-4" />
                                  Produto indisponível — remova do carrinho
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline">{item.marca}</Badge>
                                <Badge variant="outline">
                                  {item.tipo_venda === 'grade'
                                    ? `Grade ${item.total_pecas_grade} pç`
                                    : 'Unitário'}
                                </Badge>
                              </div>
                              {/* Cor Selecionada - Destacada */}
                              {item.cor_selecionada && item.cor_selecionada.cor_nome && (
                                <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                                  <span className="text-xs font-medium text-gray-600">Cor:</span>
                                  <div
                                    className="w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm"
                                    style={{ backgroundColor: item.cor_selecionada.cor_codigo_hex || item.cor_selecionada.cor_hex || '#000000' }}
                                    title={item.cor_selecionada.cor_nome}
                                  />
                                  <span className="text-sm font-semibold text-gray-900">
                                    {item.cor_selecionada.cor_nome}
                                  </span>
                                </div>
                              )}
                              {/* Tamanho Selecionado */}
                              {item.tamanho_selecionado && (
                                <div className="mt-2 inline-flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 ml-1">
                                  <span className="text-xs font-medium text-gray-600">Tamanho:</span>
                                  <span className="text-sm font-bold text-purple-900">{item.tamanho_selecionado}</span>
                                </div>
                              )}
                              <p className="text-sm text-gray-600 mt-2">
                                {formatCurrency(preco)} cada
                              </p>
                            </div>

                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-between gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removerItem(item.id, item.cor_selecionada, false, item.tamanho_selecionado)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade - 1, item.cor_selecionada, false, item.tamanho_selecionado)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-12 text-center font-semibold">
                                  {item.quantidade}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade + 1, item.cor_selecionada, false, item.tamanho_selecionado)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>

                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">
                                  {formatCurrency(preco * item.quantidade)}
                                </p>
                                {/* Quantidade total de pecas: grade = pecas por grade x nº de grades. */}
                                {(() => {
                                  const pecas = item.tipo_venda === 'grade'
                                    ? (Number(item.total_pecas_grade) || 0) * (Number(item.quantidade) || 0)
                                    : (Number(item.quantidade) || 0);
                                  return (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {pecas.toLocaleString('pt-BR')} {pecas === 1 ? 'peça' : 'peças'}
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    {/* Total e Checkout por Fornecedor */}
                    <div className="space-y-4 bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">Total:</span>
                        <span className="text-2xl sm:text-3xl font-bold text-green-600">
                          {formatCurrency(grupo.total)}
                        </span>
                      </div>

                      {/* Seleção de Lojas (quando tem lojas cadastradas) */}
                      {!hasNoLojas && (
                        <div>
                          <Label className="flex items-center gap-2 mb-2">
                            <Store className="w-4 h-4" />
                            Selecione a(s) loja(s) de entrega *
                          </Label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {lojas.filter(l => l.ativa !== false).map(loja => {
                              const isSelected = selectedLojas.has(loja.id);
                              const isBloqueada = loja.bloqueada === true;
                              return (
                                <div
                                  key={loja.id}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                                    isBloqueada
                                      ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'
                                      : isSelected
                                        ? 'border-blue-300 bg-white cursor-pointer'
                                        : 'border-gray-200 bg-white hover:bg-gray-50 cursor-pointer'
                                  }`}
                                  onClick={() => !isBloqueada && toggleLojaForGroup(grupo.fornecedor_id, loja.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isBloqueada}
                                    readOnly
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 pointer-events-none"
                                  />
                                  <Store className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate block">
                                      {loja.nome_fantasia || loja.nome}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {loja.cidade ? `${loja.cidade}/${loja.estado}` : ''}
                                      {loja.cnpj ? ` - ${loja.cnpj}` : ''}
                                    </span>
                                  </div>
                                  {isBloqueada && (
                                    <Badge className="bg-red-100 text-red-700 text-[10px] flex-shrink-0">Bloqueada</Badge>
                                  )}
                                  {!isBloqueada && (!loja.endereco_completo || !loja.cep || !loja.cidade || !loja.estado) && (
                                    <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50 text-[10px] flex-shrink-0">
                                      Sem endereço
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {selectedCount === 0 && (
                            <p className="text-xs text-yellow-700 mt-1">Selecione ao menos uma loja para finalizar.</p>
                          )}
                        </div>
                      )}

                      {/* Pagamento (para 1 loja ou sem lojas) */}
                      {(hasNoLojas || selectedCount === 1) && (
                        <div>
                          <Label className="flex items-center gap-2 mb-2">
                            <CreditCard className="w-4 h-4" />
                            Método de Pagamento *
                          </Label>
                          <Select
                            value={metodoPagamento[grupo.fornecedor_id] || ''}
                            onValueChange={(value) => setMetodoPagamento(prev => ({ ...prev, [grupo.fornecedor_id]: value }))}
                            disabled={metodosPagamento.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={metodosPagamento.length === 0 ? 'Nenhuma forma de pagamento disponível' : 'Selecione'} />
                            </SelectTrigger>
                            <SelectContent>
                              {metodosPagamento.map(metodo => (
                                <SelectItem key={metodo.value} value={metodo.value}>
                                  {metodo.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {metodosPagamento.length === 0 && (
                            <p className="text-xs text-red-600 mt-1">
                              Este fornecedor não aceita formas de pagamento compatíveis com sua conta. Entre em contato com o comercial.
                            </p>
                          )}
                          {metodosPagamento.length === 2 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Opção Boleto Faturado não disponível para sua conta
                            </p>
                          )}
                        </div>
                      )}

                      {(hasNoLojas || selectedCount === 1) && (
                        <div>
                          <Label className="mb-2 block">Observações (Opcional)</Label>
                          <Textarea
                            value={observacoes[grupo.fornecedor_id] || ''}
                            onChange={(e) => setObservacoes(prev => ({ ...prev, [grupo.fornecedor_id]: e.target.value }))}
                            placeholder="Adicione observações sobre seu pedido..."
                            rows={3}
                          />
                        </div>
                      )}

                      {/* Botão: 0 lojas selecionadas ou sem lojas → Finalizar direto */}
                      {(hasNoLojas || selectedCount === 1) && (
                        <Button
                          onClick={() => finalizarCompraPorFornecedor(grupo.fornecedor_id)}
                          disabled={
                            finalizando[grupo.fornecedor_id] ||
                            replicarModalOpen ||
                            !atingiuMinimo ||
                            !metodoPagamento[grupo.fornecedor_id] ||
                            enderecoIncompleto ||
                            user?.bloqueado ||
                            temIndisponivel
                          }
                          title={temIndisponivel ? 'Remova os produtos indisponíveis para finalizar.' : user?.bloqueado ? 'Sua conta está bloqueada.' : ''}
                          className="w-full h-12 sm:h-14 bg-green-600 hover:bg-green-700 text-base sm:text-lg font-semibold"
                        >
                          {finalizando[grupo.fornecedor_id] ? (
                            <>Processando...</>
                          ) : (
                            <>
                              Finalizar Pedido{singleSelectedLoja ? ` - ${singleSelectedLoja.nome_fantasia || singleSelectedLoja.nome}` : ''}
                              <ArrowRight className="w-5 h-5 ml-2" />
                            </>
                          )}
                        </Button>
                      )}

                      {/* Botão: 2+ lojas → Abrir validador multi-loja */}
                      {!hasNoLojas && selectedCount >= 2 && (
                        <Button
                          onClick={() => abrirMultiLojaModal(grupo, selectedLojas)}
                          disabled={finalizando[grupo.fornecedor_id] || !atingiuMinimo || user?.bloqueado || temIndisponivel}
                          className="w-full h-12 sm:h-14 bg-green-600 hover:bg-green-700 text-base sm:text-lg font-semibold"
                        >
                          Finalizar para {selectedCount} Lojas
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      )}

                      {/* Sem seleção e tem lojas */}
                      {!hasNoLojas && selectedCount === 0 && (
                        <Button
                          disabled
                          className="w-full h-12 sm:h-14 bg-gray-400 text-base sm:text-lg font-semibold cursor-not-allowed"
                        >
                          Selecione uma loja para finalizar
                        </Button>
                      )}

                      {!atingiuMinimo && (
                        <p className="text-xs text-center text-yellow-700">
                          Adicione mais {formatCurrency(valorMinimo - grupo.total)} para atingir o valor mínimo deste fornecedor
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Bloqueio por Inadimplência */}
      <Dialog open={showBloqueioModal} onOpenChange={setShowBloqueioModal}>
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
                <strong>Sua conta foi bloqueada automaticamente devido a títulos vencidos.</strong>
                <p className="mt-2">Você não poderá realizar novos pedidos até regularizar sua situação financeira.</p>
              </AlertDescription>
            </Alert>

            {dadosInadimplencia && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-semibold text-gray-900">Títulos Vencidos:</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {dadosInadimplencia.titulosVencidos.map((titulo, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-red-100">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {titulo.descricao || `Título ${titulo.pedido_id ? '#' + titulo.pedido_id.slice(-8).toUpperCase() : ''}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            Vencimento: {new Date(titulo.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className="text-red-600 font-bold">{formatCurrency(titulo.valor)}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-semibold text-gray-700">Total Vencido:</span>
                    <span className="text-red-600 font-bold text-xl">{formatCurrency(dadosInadimplencia.totalVencido)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    Regularize seus pagamentos pendentes para desbloquear sua conta e voltar a fazer pedidos.
                    Acesse a Carteira Financeira para visualizar seus débitos e enviar comprovantes.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowBloqueioModal(false)}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setShowBloqueioModal(false);
                  navigate(createPageUrl('CarteiraFinanceira'));
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Ver Meus Débitos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Replicar Pedido para Múltiplas Lojas */}
      {replicarGrupo && (
        <ReplicarPedidoModal
          open={replicarModalOpen}
          onOpenChange={setReplicarModalOpen}
          grupo={replicarGrupo}
          lojas={lojas}
          preSelectedLojaIds={replicarPreSelectedIds}
          fornecedores={fornecedores}
          user={user}
          criarPedidoParaLoja={criarPedidoParaLoja}
          getMetodosPagamentoDisponiveis={getMetodosPagamentoDisponiveis}
          onSuccess={handleReplicarSuccess}
        />
      )}
    </div>
  );
}