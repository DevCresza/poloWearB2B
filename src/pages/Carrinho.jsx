import { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Pedido } from '@/api/entities';
import { Fornecedor } from '@/api/entities';
import { Carteira } from '@/api/entities';
import { Produto } from '@/api/entities';
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
  XCircle, DollarSign, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatCurrency } from '@/utils/exportUtils';
import { useLojaContext } from '@/contexts/LojaContext';
import { Store } from 'lucide-react';
import ReplicarPedidoModal from '@/components/pedidos/ReplicarPedidoModal';

export default function Carrinho() {
  const navigate = useNavigate();
  const { lojaSelecionada, lojas, carrinhoKey, hasMultipleLojas, hasNoLojas } = useLojaContext();
  const [user, setUser] = useState(null);
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCarrinho();
  }, [carrinhoKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [fornecedoresList, produtosList] = await Promise.all([
        Fornecedor.list(),
        Produto.list()
      ]);

      setFornecedores(fornecedoresList || []);
      setProdutos(produtosList || []);

      // Verificar inadimplência automaticamente
      if (currentUser.tipo_negocio === 'multimarca') {
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
            if (!currentUser.bloqueado) {
              await User.update(currentUser.id, {
                bloqueado: true,
                motivo_bloqueio: `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`,
                data_bloqueio: new Date().toISOString(),
                total_vencido: totalVencido
              });
              currentUser.bloqueado = true;
              currentUser.motivo_bloqueio = `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`;
            }

            setDadosInadimplencia({ titulosVencidos, totalVencido });
            setShowBloqueioModal(true);
            setUser({ ...currentUser });
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

  const removerItem = (itemId, corSelecionada = null, isCapsula = false) => {
    const novoCarrinho = carrinho.filter(item => {
      // Se é cápsula, apenas comparar o ID
      if (isCapsula || item.tipo === 'capsula') {
        return item.id !== itemId;
      }

      // Se não é cápsula, usar lógica antiga de produto
      if (corSelecionada) {
        return !(item.id === itemId && item.cor_selecionada?.cor_nome === corSelecionada.cor_nome);
      }
      return item.id !== itemId;
    });
    salvarCarrinho(novoCarrinho);
  };

  const atualizarQuantidade = (itemId, novaQuantidade, corSelecionada = null, isCapsula = false) => {
    if (novaQuantidade <= 0) {
      removerItem(itemId, corSelecionada, isCapsula);
      return;
    }

    const novoCarrinho = carrinho.map(item => {
      // Se é cápsula, apenas comparar o ID
      if (isCapsula || item.tipo === 'capsula') {
        return item.id === itemId ? { ...item, quantidade: novaQuantidade } : item;
      }

      // Se não é cápsula, usar lógica antiga de produto
      const match = corSelecionada
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

      // Calcular preço do item
      let preco;
      if (item.tipo === 'capsula') {
        preco = item.preco_unitario || 0;
      } else {
        preco = item.tipo_venda === 'grade'
          ? item.preco_grade_completa
          : item.preco_por_peca;
      }

      grupos[fornecedorKey].total += preco * item.quantidade;
    });
    return Object.values(grupos);
  };

  const getMetodosPagamentoDisponiveis = (fornecedorId) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);

    // Verifica se o cliente está na lista de "sem crédito" (bloqueado para boleto)
    const clienteBloqueado = fornecedor &&
      fornecedor.clientes_boleto_faturado &&
      user &&
      fornecedor.clientes_boleto_faturado.includes(user.id);

    if (clienteBloqueado) {
      // Cliente sem crédito - apenas PIX e Cartão
      return [
        { value: 'pix', label: 'PIX' },
        { value: 'cartao_credito', label: 'Cartão de Crédito' }
      ];
    }

    // Cliente com crédito - todas as opções de pagamento
    return [
      { value: 'pix', label: 'PIX' },
      { value: 'cartao_credito', label: 'Cartão de Crédito' },
      { value: 'boleto', label: 'Boleto' },
      { value: 'transferencia', label: 'Transferência Bancária' },
      { value: 'boleto_faturado', label: 'Boleto Faturado (30 dias)' }
    ];
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
      if (fornecedor && fornecedor.pedido_minimo_valor > 0) {
        if (grupoData.total < fornecedor.pedido_minimo_valor) {
          return { success: false, error: `Valor abaixo do mínimo de ${formatCurrency(fornecedor.pedido_minimo_valor)}.` };
        }
      }

      // Mapear itens
      const itensPedido = grupoData.itens.map(item => {
        if (item.tipo === 'capsula') {
          return {
            tipo: 'capsula',
            capsula_id: item.capsula_id,
            produto_id: item.id,
            nome: item.nome,
            quantidade: item.quantidade,
            preco: item.preco_unitario,
            total: item.preco_unitario * item.quantidade,
            foto: item.imagem_capa_url,
            detalhes_produtos: item.detalhes_produtos || [],
            produto_ids: item.produto_ids || [],
            produtos_quantidades: item.produtos_quantidades || {}
          };
        }
        return {
          produto_id: item.id,
          nome: item.nome,
          marca: item.marca,
          referencia: item.referencia_polo || item.referencia_fornecedor || '',
          tipo_venda: item.tipo_venda,
          quantidade: item.quantidade,
          total_pecas_grade: item.total_pecas_grade || 0,
          preco: item.tipo_venda === 'grade' ? item.preco_grade_completa : item.preco_por_peca,
          total: (item.tipo_venda === 'grade' ? item.preco_grade_completa : item.preco_por_peca) * item.quantidade,
          foto: getPrimeiraFoto(item),
          grade_selecionada: item.grade_configuracao || null,
          cor_selecionada: item.cor_selecionada || null
        };
      });

      // Calcular total com base nos itens (pode ter sido editado no modal)
      const totalCalculado = itensPedido.reduce((sum, it) => sum + it.total, 0);

      // Endereço de entrega
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
        observacoes_comprador: obs || ''
      };

      const pedido = await Pedido.create(pedidoData);

      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const descricaoCarteira = fornecedorId === 'capsula'
        ? `Pedido #${pedido.id.substring(0, 8)} - Cápsula`
        : `Pedido #${pedido.id.substring(0, 8)} - ${fornecedor?.nome_fantasia || fornecedor?.nome_marca}`;

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

  const abrirReplicarModal = (grupo) => {
    setReplicarGrupo(grupo);
    setReplicarModalOpen(true);
  };

  const handleReplicarSuccess = (fornecedorId) => {
    // Limpar carrinho deste fornecedor após replicação bem-sucedida
    const novoCarrinho = removerItensFornecedorDoCarrinho(fornecedorId);
    salvarCarrinho(novoCarrinho);
    if (novoCarrinho.length === 0) {
      navigate(createPageUrl('MeusPedidos'));
    }
  };

  const finalizarCompraPorFornecedor = async (fornecedorId) => {
    // Se o user tem lojas mas nenhuma selecionada, exigir seleção
    if (!hasNoLojas && !lojaSelecionada) {
      toast.info('Selecione uma loja no seletor do cabeçalho antes de finalizar o pedido.');
      return;
    }

    // Determinar dados de endereço: da loja (se selecionada) ou do user (legado)
    const enderecoSource = lojaSelecionada || user;
    if (!enderecoSource.endereco_completo || !enderecoSource.cep || !enderecoSource.cidade || !enderecoSource.estado) {
      const msg = lojaSelecionada
        ? 'Complete o endereço da loja selecionada em Meu Perfil > Minhas Lojas antes de finalizar.'
        : 'Por favor, cadastre seu endereço de entrega completo no seu perfil antes de finalizar o pedido.';
      toast.info(msg);
      return;
    }

    if (!metodoPagamento[fornecedorId]) {
      toast.info('Por favor, selecione um método de pagamento para este fornecedor.');
      return;
    }

    if (user.bloqueado) {
      toast.error(`Sua conta está bloqueada. ${user.motivo_bloqueio ? `Motivo: ${user.motivo_bloqueio}.` : ''} Regularize seus pagamentos para fazer novos pedidos.`);
      return;
    }

    // Verificação em tempo real de inadimplência antes de finalizar
    // Se loja selecionada, verificar apenas títulos dessa loja
    if (user.tipo_negocio === 'multimarca' || user.tipo_negocio === 'franqueado') {
      try {
        const freshUser = await User.me();
        if (freshUser.bloqueado) {
          setUser(freshUser);
          toast.error(`Sua conta está bloqueada. ${freshUser.motivo_bloqueio ? `Motivo: ${freshUser.motivo_bloqueio}.` : ''} Regularize seus pagamentos para fazer novos pedidos.`);
          return;
        }

        // Filtro por loja quando selecionada
        const filtroCarteira = { cliente_user_id: freshUser.id };
        if (lojaSelecionada) {
          filtroCarteira.loja_id = lojaSelecionada.id;
        }
        const titulosCliente = await Carteira.filter(filtroCarteira);
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
          if (lojaSelecionada) {
            // Bloqueio POR LOJA - apenas impede a compra nesta loja
            setDadosInadimplencia({ titulosVencidos, totalVencido });
            setShowBloqueioModal(true);
            return;
          }
          // Bloqueio global (legado sem lojas)
          await User.update(freshUser.id, {
            bloqueado: true,
            motivo_bloqueio: `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`,
            data_bloqueio: new Date().toISOString(),
            total_vencido: totalVencido
          });
          freshUser.bloqueado = true;
          freshUser.motivo_bloqueio = `Bloqueio automático: ${titulosVencidos.length} título(s) vencido(s) totalizando R$ ${totalVencido.toFixed(2)}`;
          setUser({ ...freshUser });
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
      if (fornecedor && fornecedor.pedido_minimo_valor > 0) {
        if (grupo.total < fornecedor.pedido_minimo_valor) {
          toast.error(
            `O pedido para ${fornecedor.nome_marca} não atingiu o valor mínimo de ${formatCurrency(fornecedor.pedido_minimo_valor)}. ` +
            `Valor atual: ${formatCurrency(grupo.total)}`
          );
          setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
          return;
        }
      }

      const result = await criarPedidoParaLoja(
        grupo,
        lojaSelecionada,
        metodoPagamento[fornecedorId],
        observacoes[fornecedorId] || ''
      );

      if (!result.success) {
        toast.error(result.error || 'Erro ao processar o pedido.');
        setFinalizando(prev => ({ ...prev, [fornecedorId]: false }));
        return;
      }

      // Remover itens do carrinho deste fornecedor
      const novoCarrinho = removerItensFornecedorDoCarrinho(fornecedorId);
      salvarCarrinho(novoCarrinho);

      // Mensagem de sucesso
      if (grupo.temCapsula) {
        const fornecedorNome = fornecedor?.nome_marca || 'Fornecedor';
        toast.success(`Pedido para ${fornecedorNome} (incluindo cápsula) criado com sucesso!`);
      } else {
        const fornecedorNome = fornecedor?.nome_marca || 'Fornecedor';
        const contatoFornecedor = fornecedor?.contato_envio_whatsapp || fornecedor?.contato_comercial_whatsapp || 'Não disponível';
        const emailFornecedor = fornecedor?.contato_envio_email || fornecedor?.contato_comercial_email || 'Não disponível';

        toast.success(
          `Pedido para ${fornecedorNome} criado com sucesso!\n\n` +
          `Email: ${emailFornecedor}\n` +
          `WhatsApp: ${contatoFornecedor}\n\n` +
          `O fornecedor foi notificado automaticamente e entrará em contato em breve.`
        );
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
            {/* Alerta de bloqueio */}
            {user?.bloqueado && (
              <Alert className="bg-red-50 border-red-300">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 text-sm sm:text-base">
                  <strong>Conta bloqueada.</strong> {user.motivo_bloqueio ? `Motivo: ${user.motivo_bloqueio}.` : ''} Regularize seus pagamentos para fazer novos pedidos.
                </AlertDescription>
              </Alert>
            )}

            {/* Alerta sobre endereço */}
            {(() => {
              const src = lojaSelecionada || user;
              const semEndereco = !src?.endereco_completo || !src?.cep || !src?.cidade || !src?.estado;
              if (!semEndereco) return null;
              const msg = lojaSelecionada
                ? 'Complete o endereço da loja selecionada em Meu Perfil > Minhas Lojas antes de finalizar os pedidos.'
                : 'Você precisa cadastrar seu endereço de entrega completo no seu perfil antes de finalizar os pedidos.';
              return (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-sm sm:text-base">
                    <strong>Atenção:</strong> {msg}
                  </AlertDescription>
                </Alert>
              );
            })()}

            {/* Lista de Produtos por Fornecedor */}
            {grupos.map((grupo) => {
              const fornecedor = fornecedores.find(f => f.id === grupo.fornecedor_id);
              const valorMinimo = fornecedor?.pedido_minimo_valor || 0;
              const atingiuMinimo = grupo.total >= valorMinimo;
              const metodosPagamento = getMetodosPagamentoDisponiveis(grupo.fornecedor_id);
              const enderecoSource = lojaSelecionada || user;
              const enderecoIncompleto = !enderecoSource?.endereco_completo || !enderecoSource?.cep || !enderecoSource?.cidade || !enderecoSource?.estado;

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
                                    {item.detalhes_produtos?.length || 0} produtos inclusos
                                  </p>

                                  {/* Mostrar cores disponíveis na cápsula */}
                                  {(() => {
                                    // Coletar todas as cores e somar quantidades de grades
                                    const coresComQuantidade = new Map();
                                    item.detalhes_produtos?.forEach(detalhe => {
                                      const config = detalhe.configuracao;
                                      if (config && typeof config === 'object' && config.variantes && Array.isArray(config.variantes)) {
                                        config.variantes.forEach(variante => {
                                          const corNome = variante.cor_nome;
                                          const corHex = variante.cor_codigo_hex || '#000000';
                                          const quantidade = variante.quantidade || 0;

                                          if (coresComQuantidade.has(corNome)) {
                                            const existing = coresComQuantidade.get(corNome);
                                            existing.quantidade += quantidade;
                                          } else {
                                            coresComQuantidade.set(corNome, {
                                              hex: corHex,
                                              quantidade: quantidade
                                            });
                                          }
                                        });
                                      }
                                    });

                                    if (coresComQuantidade.size > 0) {
                                      return (
                                        <div className="mt-3 bg-white rounded-lg p-3 border border-purple-100">
                                          <p className="text-sm font-semibold text-gray-900 mb-2">Cores incluídas:</p>
                                          <div className="space-y-1.5">
                                            {Array.from(coresComQuantidade.entries()).map(([corNome, dados], idx) => (
                                              <div key={idx} className="flex items-center gap-2 text-sm">
                                                <div
                                                  className="w-5 h-5 rounded-full border-2 border-gray-300 shadow-sm flex-shrink-0"
                                                  style={{ backgroundColor: dados.hex }}
                                                />
                                                <span className="text-gray-800">
                                                  <strong>{corNome}</strong> - {dados.quantidade} grade(s)
                                                </span>
                                              </div>
                                            ))}
                                          </div>
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
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Renderização normal para produtos
                        const preco = item.tipo_venda === 'grade'
                          ? item.preco_grade_completa
                          : item.preco_por_peca;
                        const itemKey = `${item.id}_${item.cor_selecionada?.cor_nome || 'default'}`;

                        return (
                          <div key={itemKey} className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
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

                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base sm:text-lg text-gray-900 line-clamp-2">{item.nome}</h3>
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
                              <p className="text-sm text-gray-600 mt-2">
                                {formatCurrency(preco)} cada
                              </p>
                            </div>

                            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-between gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removerItem(item.id, item.cor_selecionada)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade - 1, item.cor_selecionada)}
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
                                  onClick={() => atualizarQuantidade(item.id, item.quantidade + 1, item.cor_selecionada)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>

                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">
                                  {formatCurrency(preco * item.quantidade)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

                    {/* Total e Checkout por Fornecedor */}
                    <div className="space-y-4 bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-200">
                      {/* Loja selecionada */}
                      {lojaSelecionada && (
                        <div className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-blue-100">
                          <Store className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-600">Comprando para:</span>
                          <span className="font-semibold text-blue-700">
                            {lojaSelecionada.nome_fantasia || lojaSelecionada.nome}
                            {lojaSelecionada.cidade ? ` - ${lojaSelecionada.cidade}` : ''}
                          </span>
                        </div>
                      )}
                      {!hasNoLojas && !lojaSelecionada && (
                        <Alert className="border-yellow-200 bg-yellow-50">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <AlertDescription className="text-yellow-800 text-sm">
                            Selecione uma loja no seletor do cabeçalho antes de finalizar o pedido.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">Total:</span>
                        <span className="text-2xl sm:text-3xl font-bold text-green-600">
                          {formatCurrency(grupo.total)}
                        </span>
                      </div>

                      <div>
                        <Label className="flex items-center gap-2 mb-2">
                          <CreditCard className="w-4 h-4" />
                          Método de Pagamento *
                        </Label>
                        <Select 
                          value={metodoPagamento[grupo.fornecedor_id] || ''} 
                          onValueChange={(value) => setMetodoPagamento(prev => ({ ...prev, [grupo.fornecedor_id]: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {metodosPagamento.map(metodo => (
                              <SelectItem key={metodo.value} value={metodo.value}>
                                {metodo.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {metodosPagamento.length === 2 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Opção Boleto Faturado não disponível para sua conta
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="mb-2 block">Observações (Opcional)</Label>
                        <Textarea
                          value={observacoes[grupo.fornecedor_id] || ''}
                          onChange={(e) => setObservacoes(prev => ({ ...prev, [grupo.fornecedor_id]: e.target.value }))}
                          placeholder="Adicione observações sobre seu pedido..."
                          rows={3}
                        />
                      </div>

                      <Button
                        onClick={() => finalizarCompraPorFornecedor(grupo.fornecedor_id)}
                        disabled={
                          finalizando[grupo.fornecedor_id] ||
                          replicarModalOpen ||
                          !atingiuMinimo ||
                          !metodoPagamento[grupo.fornecedor_id] ||
                          enderecoIncompleto ||
                          user?.bloqueado
                        }
                        title={user?.bloqueado ? 'Sua conta está bloqueada. Regularize seus pagamentos.' : ''}
                        className="w-full h-12 sm:h-14 bg-green-600 hover:bg-green-700 text-base sm:text-lg font-semibold"
                      >
                        {finalizando[grupo.fornecedor_id] ? (
                          <>Processando...</>
                        ) : (
                          <>
                            Finalizar Pedido - {fornecedor?.nome_marca}
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>

                      {hasMultipleLojas && lojaSelecionada && (
                        <Button
                          variant="outline"
                          onClick={() => abrirReplicarModal(grupo)}
                          disabled={finalizando[grupo.fornecedor_id] || user?.bloqueado}
                          className="w-full h-10 border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Replicar para Outras Lojas
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
                            {titulo.descricao || `Título ${titulo.pedido_id ? '#' + titulo.pedido_id.substring(0, 8) : ''}`}
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
          lojaSelecionada={lojaSelecionada}
          fornecedores={fornecedores}
          criarPedidoParaLoja={criarPedidoParaLoja}
          getMetodosPagamentoDisponiveis={getMetodosPagamentoDisponiveis}
          onSuccess={handleReplicarSuccess}
        />
      )}
    </div>
  );
}