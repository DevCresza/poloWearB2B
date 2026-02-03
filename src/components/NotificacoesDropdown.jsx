import { useState, useEffect, useRef } from 'react';
import { Notificacao, Carteira, Pedido, Produto } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  Package,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info,
  ShoppingCart,
  Archive,
  Clock,
  X,
  Check,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helpers para persistir notificações auto-geradas dispensadas no localStorage
const DISMISSED_KEY = 'polo_notif_dismissed';

const getDismissedIds = (userId) => {
  try {
    const raw = localStorage.getItem(`${DISMISSED_KEY}_${userId}`);
    if (!raw) return {};
    const data = JSON.parse(raw);
    // Limpar entradas com mais de 7 dias para não crescer infinitamente
    const agora = Date.now();
    const limpo = {};
    for (const [id, ts] of Object.entries(data)) {
      if (agora - ts < 7 * 24 * 60 * 60 * 1000) {
        limpo[id] = ts;
      }
    }
    return limpo;
  } catch {
    return {};
  }
};

const dismissNotifId = (userId, notifId) => {
  const data = getDismissedIds(userId);
  data[notifId] = Date.now();
  try {
    localStorage.setItem(`${DISMISSED_KEY}_${userId}`, JSON.stringify(data));
  } catch {
    // localStorage cheio ou indisponível
  }
};

const dismissMultipleNotifIds = (userId, notifIds) => {
  const data = getDismissedIds(userId);
  const agora = Date.now();
  for (const id of notifIds) {
    data[id] = agora;
  }
  try {
    localStorage.setItem(`${DISMISSED_KEY}_${userId}`, JSON.stringify(data));
  } catch {
    // localStorage cheio ou indisponível
  }
};

export default function NotificacoesDropdown({ userId, userRole, userTipoNegocio, userFornecedorId }) {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar notificações
  useEffect(() => {
    if (userId) {
      loadNotificacoes();
      // Atualizar a cada 60 segundos
      const interval = setInterval(loadNotificacoes, 60000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const loadNotificacoes = async () => {
    try {
      setLoading(true);

      // Buscar notificações do usuário
      let notificacoesUsuario = [];
      try {
        notificacoesUsuario = await Notificacao.filter({ usuario_id: userId }, '-created_at', 50);
      } catch (e) {
        // Se a tabela não existir, continua com array vazio
        console.log('Tabela notificacoes ainda não existe ou está vazia');
      }

      // Gerar notificações automáticas baseadas em eventos do sistema
      const notificacoesAutomaticas = await gerarNotificacoesAutomaticas();

      // Filtrar auto-geradas que já foram dispensadas (persistido no localStorage)
      const dismissed = getDismissedIds(userId);
      const autoFiltradas = notificacoesAutomaticas.filter(n => !dismissed[n.id]);

      // Combinar e ordenar por data
      const todasNotificacoes = [...notificacoesUsuario, ...autoFiltradas]
        .sort((a, b) => new Date(b.created_at || b.data) - new Date(a.created_at || a.data));

      setNotificacoes(todasNotificacoes);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gerar notificações automáticas baseadas em dados do sistema
  const gerarNotificacoesAutomaticas = async () => {
    const notificacoesAuto = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    try {
      // Para clientes (multimarca e franqueado): verificar boletos e pedidos
      const isCliente = userTipoNegocio === 'multimarca' || userTipoNegocio === 'franqueado';
      if (isCliente) {
        // Verificar boletos vencendo
        const titulos = await Carteira.filter({ cliente_user_id: userId, status: 'pendente' });

        titulos.forEach(titulo => {
          const vencimento = new Date(titulo.data_vencimento + 'T00:00:00');
          const diffDias = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));

          if (diffDias < 0) {
            notificacoesAuto.push({
              id: `vencido-${titulo.id}`,
              tipo: 'alerta',
              titulo: 'Boleto Vencido',
              mensagem: `Você tem um boleto vencido há ${Math.abs(diffDias)} dia(s) no valor de R$ ${titulo.valor?.toFixed(2)}`,
              icone: 'alerta',
              lida: false,
              data: titulo.data_vencimento,
              link: '/CarteiraFinanceira',
              autogerada: true
            });
          } else if (diffDias <= 3 && diffDias >= 0) {
            notificacoesAuto.push({
              id: `vencendo-${titulo.id}`,
              tipo: 'aviso',
              titulo: diffDias === 0 ? 'Boleto Vence Hoje!' : `Boleto Vence em ${diffDias} dia(s)`,
              mensagem: `Boleto no valor de R$ ${titulo.valor?.toFixed(2)} vence ${diffDias === 0 ? 'hoje' : `em ${diffDias} dia(s)`}`,
              icone: 'dinheiro',
              lida: false,
              data: new Date().toISOString(),
              link: '/CarteiraFinanceira',
              autogerada: true
            });
          }
        });

        // Verificar pedidos do cliente com atualizações recentes (todos os status relevantes)
        const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

        const statusNotificaveis = [
          { status: 'em_producao', tipo: 'info', titulo: 'Pedido em Produção', icone: 'pedido', mensagem: (id) => `Seu pedido #${id} está em produção` },
          { status: 'faturado', tipo: 'info', titulo: 'Pedido Faturado', icone: 'dinheiro', mensagem: (id) => `Seu pedido #${id} foi faturado` },
          { status: 'em_transporte', tipo: 'aviso', titulo: 'Pedido em Transporte', icone: 'pedido', mensagem: (id) => `Seu pedido #${id} está a caminho!` },
          { status: 'finalizado', tipo: 'sucesso', titulo: 'Pedido Finalizado', icone: 'sucesso', mensagem: (id) => `Seu pedido #${id} foi finalizado!` },
          { status: 'cancelado', tipo: 'alerta', titulo: 'Pedido Cancelado', icone: 'alerta', mensagem: (id) => `Seu pedido #${id} foi cancelado` }
        ];

        for (const statusInfo of statusNotificaveis) {
          try {
            const pedidos = await Pedido.filter({ comprador_user_id: userId, status: statusInfo.status }, '-updated_at', 5);
            pedidos.forEach(pedido => {
              const dataAtualizacao = new Date(pedido.updated_at || pedido.created_date);
              if (dataAtualizacao >= seteDiasAtras) {
                notificacoesAuto.push({
                  id: `pedido-${statusInfo.status}-${pedido.id}`,
                  tipo: statusInfo.tipo,
                  titulo: statusInfo.titulo,
                  mensagem: statusInfo.mensagem(pedido.id.slice(-8).toUpperCase()),
                  icone: statusInfo.icone,
                  lida: false,
                  data: pedido.updated_at || pedido.created_date,
                  link: '/MeusPedidos',
                  autogerada: true
                });
              }
            });
          } catch (e) {
            // Ignora erro de pedidos específicos
          }
        }

        // Notificação de NF e Boleto disponíveis - solicitar confirmação de recebimento
        try {
          const pedidosCliente = await Pedido.filter({ comprador_user_id: userId }, '-updated_at', 20);
          const seteDiasAtrasDoc = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

          pedidosCliente.forEach(pedido => {
            const dataAtualizacao = new Date(pedido.updated_at || pedido.created_date);
            if (dataAtualizacao < seteDiasAtrasDoc) return;
            const idPedido = pedido.id.slice(-8).toUpperCase();

            // NF disponível mas não confirmada
            if (pedido.nf_url && !pedido.cliente_confirmou_nf) {
              notificacoesAuto.push({
                id: `nf-disponivel-${pedido.id}`,
                tipo: 'aviso',
                titulo: 'Nota Fiscal Disponível',
                mensagem: `A NF do pedido #${idPedido} foi emitida. Confirme o recebimento.`,
                icone: 'dinheiro',
                lida: false,
                data: pedido.nf_data_upload || pedido.updated_at,
                link: '/MeusPedidos',
                autogerada: true
              });
            }

            // Boleto disponível mas não confirmado
            if (pedido.boleto_url && !pedido.cliente_confirmou_boleto) {
              notificacoesAuto.push({
                id: `boleto-disponivel-${pedido.id}`,
                tipo: 'aviso',
                titulo: 'Boleto Disponível',
                mensagem: `O boleto do pedido #${idPedido} foi emitido. Confirme o recebimento.`,
                icone: 'dinheiro',
                lida: false,
                data: pedido.boleto_data_upload || pedido.updated_at,
                link: '/MeusPedidos',
                autogerada: true
              });
            }
          });
        } catch (e) {
          // Ignora erro
        }

        // Notificação de comprovante aprovado ou recusado
        try {
          const titulosCliente = await Carteira.filter({ cliente_user_id: userId }, '-created_at', 20);

          titulosCliente.forEach(titulo => {
            if (!titulo.comprovante_analisado) return;

            if (titulo.comprovante_aprovado) {
              notificacoesAuto.push({
                id: `comprovante-aprovado-${titulo.id}`,
                tipo: 'sucesso',
                titulo: 'Comprovante Aprovado',
                mensagem: `Seu comprovante foi aprovado e o título de R$ ${titulo.valor?.toFixed(2)} foi baixado.`,
                icone: 'sucesso',
                lida: false,
                data: titulo.updated_at || new Date().toISOString(),
                link: '/CarteiraFinanceira',
                autogerada: true
              });
            } else {
              notificacoesAuto.push({
                id: `comprovante-recusado-${titulo.id}`,
                tipo: 'alerta',
                titulo: 'Comprovante Recusado',
                mensagem: `Seu comprovante foi recusado${titulo.motivo_recusa_comprovante ? ': ' + titulo.motivo_recusa_comprovante : ''}. Reenvie o comprovante.`,
                icone: 'alerta',
                lida: false,
                data: titulo.updated_at || new Date().toISOString(),
                link: '/CarteiraFinanceira',
                autogerada: true
              });
            }
          });
        } catch (e) {
          // Ignora erro
        }
      }

      // Para fornecedores: verificar novos pedidos
      if (userTipoNegocio === 'fornecedor' || userRole === 'admin') {
        // Buscar pedidos novos das últimas 24h
        const pedidosNovos = await Pedido.filter({ status: 'novo_pedido' }, '-created_date', 10);
        const umDiaAtras = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);

        pedidosNovos.forEach(pedido => {
          const dataCriacao = new Date(pedido.created_date);
          if (dataCriacao >= umDiaAtras) {
            notificacoesAuto.push({
              id: `novo-pedido-${pedido.id}`,
              tipo: 'info',
              titulo: 'Novo Pedido Recebido',
              mensagem: `Pedido #${pedido.id.slice(-8).toUpperCase()} aguardando análise`,
              icone: 'carrinho',
              lida: false,
              data: pedido.created_date,
              link: '/PedidosFornecedor',
              autogerada: true
            });
          }
        });

        // Verificar confirmações do cliente (NF, boleto, recebimento de produto)
        try {
          const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
          const filtros = userFornecedorId
            ? { fornecedor_id: userFornecedorId }
            : {};

          // Buscar pedidos recentes que podem ter confirmações
          const pedidosRecentes = await Pedido.filter(filtros, '-updated_at', 20);

          pedidosRecentes.forEach(pedido => {
            const dataAtualizacao = new Date(pedido.updated_at || pedido.created_date);
            if (dataAtualizacao < seteDiasAtras) return;

            const idPedido = pedido.id.slice(-8).toUpperCase();

            if (pedido.cliente_confirmou_nf) {
              notificacoesAuto.push({
                id: `confirmou-nf-${pedido.id}`,
                tipo: 'sucesso',
                titulo: 'NF Confirmada pelo Cliente',
                mensagem: `Cliente confirmou recebimento da NF do pedido #${idPedido}`,
                icone: 'sucesso',
                lida: false,
                data: pedido.updated_at || pedido.created_date,
                link: '/PedidosFornecedor',
                autogerada: true
              });
            }

            if (pedido.cliente_confirmou_boleto) {
              notificacoesAuto.push({
                id: `confirmou-boleto-${pedido.id}`,
                tipo: 'sucesso',
                titulo: 'Boleto Confirmado pelo Cliente',
                mensagem: `Cliente confirmou recebimento do boleto do pedido #${idPedido}`,
                icone: 'dinheiro',
                lida: false,
                data: pedido.updated_at || pedido.created_date,
                link: '/PedidosFornecedor',
                autogerada: true
              });
            }

            if (pedido.cliente_confirmou_recebimento) {
              notificacoesAuto.push({
                id: `confirmou-recebimento-${pedido.id}`,
                tipo: 'sucesso',
                titulo: 'Produto Recebido pelo Cliente',
                mensagem: `Cliente confirmou recebimento do pedido #${idPedido}`,
                icone: 'pedido',
                lida: false,
                data: pedido.updated_at || pedido.created_date,
                link: '/PedidosFornecedor',
                autogerada: true
              });
            }
          });
        } catch (e) {
          // Ignora erro
        }

        // Verificar produtos com estoque baixo (apenas pronta_entrega, ignora programação/sob_encomenda)
        try {
          const produtos = await Produto.list();
          const produtosEstoque = produtos.filter(p => p.disponibilidade === 'pronta_entrega');

          const produtosBaixoEstoque = produtosEstoque.filter(p => {
            const estoqueAtual = p.estoque_atual || 0;
            const estoqueMinimo = p.estoque_minimo || 5;
            return estoqueAtual <= estoqueMinimo && estoqueAtual > 0;
          }).slice(0, 5);

          produtosBaixoEstoque.forEach(produto => {
            notificacoesAuto.push({
              id: `estoque-baixo-${produto.id}`,
              tipo: 'aviso',
              titulo: 'Estoque Baixo',
              mensagem: `${produto.nome} está com estoque baixo (${produto.estoque_atual || 0} un.)`,
              icone: 'estoque',
              lida: false,
              data: new Date().toISOString(),
              link: '/GestaoEstoque',
              autogerada: true
            });
          });

          // Produtos sem estoque (apenas pronta_entrega)
          const produtosSemEstoque = produtosEstoque.filter(p => (p.estoque_atual || 0) === 0 && p.ativo).slice(0, 3);
          produtosSemEstoque.forEach(produto => {
            notificacoesAuto.push({
              id: `sem-estoque-${produto.id}`,
              tipo: 'alerta',
              titulo: 'Produto Sem Estoque',
              mensagem: `${produto.nome} está sem estoque`,
              icone: 'estoque',
              lida: false,
              data: new Date().toISOString(),
              link: '/GestaoEstoque',
              autogerada: true
            });
          });
        } catch (e) {
          // Ignora erro de produtos
        }
      }

      // Para admin e fornecedor: verificar comprovantes pendentes de análise
      if (userRole === 'admin' || userTipoNegocio === 'fornecedor') {
        try {
          const comprovantesPendentes = await Carteira.filter({ status: 'em_analise' }, '-created_at', 10);
          if (comprovantesPendentes.length > 0) {
            notificacoesAuto.push({
              id: `comprovantes-pendentes`,
              tipo: 'aviso',
              titulo: 'Comprovantes Recebidos',
              mensagem: `${comprovantesPendentes.length} comprovante(s) enviado(s) por clientes aguardando análise`,
              icone: 'dinheiro',
              lida: false,
              data: comprovantesPendentes[0]?.created_at || new Date().toISOString(),
              link: '/CarteiraFinanceira',
              autogerada: true
            });
          }
        } catch (e) {
          // Ignora erro
        }
      }

    } catch (error) {
      console.error('Erro ao gerar notificações automáticas:', error);
    }

    return notificacoesAuto;
  };

  // Marcar notificação como lida
  const marcarComoLida = async (notificacao) => {
    if (notificacao.autogerada) {
      // Persistir no localStorage para que não volte ao recarregar
      dismissNotifId(userId, notificacao.id);
      setNotificacoes(prev => prev.filter(n => n.id !== notificacao.id));
      return;
    }

    try {
      await Notificacao.update(notificacao.id, { lida: true });
      setNotificacoes(prev =>
        prev.map(n => n.id === notificacao.id ? { ...n, lida: true } : n)
      );
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  // Marcar todas como lidas
  const marcarTodasComoLidas = async () => {
    try {
      // Atualiza notificações do banco
      const notificacoesBanco = notificacoes.filter(n => !n.autogerada && !n.lida);
      for (const notif of notificacoesBanco) {
        await Notificacao.update(notif.id, { lida: true });
      }

      // Persistir auto-geradas no localStorage
      const autoIds = notificacoes.filter(n => n.autogerada).map(n => n.id);
      if (autoIds.length > 0) {
        dismissMultipleNotifIds(userId, autoIds);
      }

      // Remove auto-geradas e marca banco como lidas
      setNotificacoes(prev =>
        prev.filter(n => !n.autogerada).map(n => ({ ...n, lida: true }))
      );
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  // Obter ícone baseado no tipo
  const getIcone = (icone, tipo) => {
    const iconMap = {
      pedido: Package,
      dinheiro: DollarSign,
      alerta: AlertTriangle,
      sucesso: CheckCircle,
      info: Info,
      carrinho: ShoppingCart,
      estoque: Archive,
      sistema: Bell
    };

    const Icon = iconMap[icone] || Bell;

    const colorMap = {
      alerta: 'text-red-500',
      aviso: 'text-orange-500',
      sucesso: 'text-green-500',
      info: 'text-blue-500'
    };

    return <Icon className={`w-5 h-5 ${colorMap[tipo] || 'text-gray-500'}`} />;
  };

  // Contar não lidas
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do Sino */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {naoLidas > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
            {naoLidas > 9 ? '9+' : naoLidas}
          </Badge>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-800">Notificações</h3>
              {naoLidas > 0 && (
                <Badge className="bg-red-500 text-white">{naoLidas} nova(s)</Badge>
              )}
            </div>
            {naoLidas > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700"
                onClick={marcarTodasComoLidas}
              >
                <Check className="w-3 h-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>

          {/* Lista de Notificações */}
          <ScrollArea className="max-h-96">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Bell className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y">
                {notificacoes.map((notificacao) => (
                  <div
                    key={notificacao.id}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notificacao.lida ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      marcarComoLida(notificacao);
                      if (notificacao.link) {
                        window.location.href = notificacao.link;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        notificacao.tipo === 'alerta' ? 'bg-red-100' :
                        notificacao.tipo === 'aviso' ? 'bg-orange-100' :
                        notificacao.tipo === 'sucesso' ? 'bg-green-100' :
                        'bg-blue-100'
                      }`}>
                        {getIcone(notificacao.icone, notificacao.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${!notificacao.lida ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notificacao.titulo}
                          </p>
                          {!notificacao.lida && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {notificacao.mensagem}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(notificacao.data || notificacao.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notificacoes.length > 0 && (
            <div className="px-4 py-2 border-t bg-gray-50 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500"
                onClick={() => loadNotificacoes()}
              >
                Atualizar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
