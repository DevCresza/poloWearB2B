import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notificacao } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { linkInternoSeguro } from '@/utils/urlSegura';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// O sino era a consulta mais cara do banco (65% do tempo): pedidos.* inteiro a
// cada 60 s, montado duas vezes no Layout. Agora: uma instancia so, colunas
// enxutas de pedidos_resumo (que respeita a RLS), 5 min de intervalo e pausa com
// a aba escondida.
const INTERVALO_MS = 5 * 60 * 1000;

// Colunas que o sino usa. Nada de itens/variantes: sao essas colunas jsonb que
// faziam cada chamada ler 128 MB.
const COLS_PEDIDO = 'id,status,created_date,updated_at,nf_url,nf_data_upload,boleto_url,boleto_data_upload,cliente_confirmou_nf,cliente_confirmou_boleto,cliente_confirmou_recebimento';
const COLS_TITULO = 'id,valor,data_vencimento,status,updated_at,comprovante_analisado,comprovante_aprovado,motivo_recusa_comprovante,comprovante_data_upload,pedido_id';

const STATUS_NOTIFICAVEIS = {
  em_producao: { tipo: 'info', titulo: 'Pedido em Produção', icone: 'pedido', mensagem: (id) => `Seu pedido #${id} está em produção` },
  faturado: { tipo: 'info', titulo: 'Pedido Faturado', icone: 'dinheiro', mensagem: (id) => `Seu pedido #${id} foi faturado` },
  em_transporte: { tipo: 'aviso', titulo: 'Pedido em Transporte', icone: 'pedido', mensagem: (id) => `Seu pedido #${id} está a caminho!` },
  pendente_pagamento: { tipo: 'aviso', titulo: 'Pedido Entregue', icone: 'dinheiro', mensagem: (id) => `Seu pedido #${id} foi entregue! Aguardando confirmação de pagamento.` },
  finalizado: { tipo: 'sucesso', titulo: 'Pedido Finalizado', icone: 'sucesso', mensagem: (id) => `Seu pedido #${id} foi finalizado!` },
  cancelado: { tipo: 'alerta', titulo: 'Pedido Cancelado', icone: 'alerta', mensagem: (id) => `Seu pedido #${id} foi cancelado` }
};

// Lanca o erro do supabase-js (que vem no retorno, nao como excecao).
const dados = ({ data, error }) => {
  if (error) throw error;
  return data || [];
};

// Supabase retorna timestamps sem timezone (ex: "2026-02-12 10:00:00")
// JS interpreta como local time, mas na verdade é UTC. Precisamos normalizar.
const parseAsUTC = (dateStr) => {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  // Se a string não contém indicador de timezone (Z, +, -) após a data, é UTC do Supabase
  if (typeof dateStr === 'string' && !dateStr.match(/[Z+-]\d{0,2}:?\d{0,2}$/i) && !dateStr.endsWith('Z')) {
    // Adicionar Z para interpretar como UTC
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  }
  return d;
};

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

// Notificacoes calculadas a partir dos dados (nao ficam gravadas no banco).
async function gerarNotificacoesAutomaticas({ userId, userRole, userTipoNegocio, userFornecedorId }) {
  const notificacoesAuto = [];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const idCurto = (id) => id.slice(-8).toUpperCase();

  const isCliente = userTipoNegocio === 'multimarca' || userTipoNegocio === 'franqueado';
  const isAdmin = userRole === 'admin';
  const isFornecedor = userTipoNegocio === 'fornecedor';

  // Cada bloco e independente: se um falhar, os outros ainda aparecem.
  const tarefas = [];

  if (isCliente) {
    // Boletos vencidos ou vencendo em ate 3 dias
    tarefas.push(
      supabase.from('carteira').select(COLS_TITULO)
        .eq('cliente_user_id', userId).eq('status', 'pendente')
        .then(dados)
        .then((titulos) => {
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
            } else if (diffDias <= 3) {
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
        })
    );

    // Mudancas de status dos ultimos 7 dias: UMA consulta com .in('status'),
    // no lugar das 6 (uma por status) de antes. Mantem ate 5 por status.
    tarefas.push(
      supabase.from('pedidos_resumo').select(COLS_PEDIDO)
        .eq('comprador_user_id', userId)
        .in('status', Object.keys(STATUS_NOTIFICAVEIS))
        .gte('updated_at', seteDiasAtras.toISOString())
        .order('updated_at', { ascending: false })
        .limit(30)
        .then(dados)
        .then((pedidos) => {
          const porStatus = {};
          pedidos.forEach(pedido => {
            porStatus[pedido.status] = (porStatus[pedido.status] || 0) + 1;
            if (porStatus[pedido.status] > 5) return;
            const info = STATUS_NOTIFICAVEIS[pedido.status];
            notificacoesAuto.push({
              id: `pedido-${pedido.status}-${pedido.id}`,
              tipo: info.tipo,
              titulo: info.titulo,
              mensagem: info.mensagem(idCurto(pedido.id)),
              icone: info.icone,
              lida: false,
              data: pedido.updated_at || pedido.created_date,
              link: '/MeusPedidos',
              autogerada: true
            });
          });
        })
    );

    // NF e boleto disponiveis/atualizados.
    // ID inclui data de upload para que re-uploads gerem novas notificações
    tarefas.push(
      supabase.from('pedidos_resumo').select(COLS_PEDIDO)
        .eq('comprador_user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20)
        .then(dados)
        .then((pedidosCliente) => {
          pedidosCliente.forEach(pedido => {
            const idPedido = idCurto(pedido.id);

            if (pedido.nf_url && pedido.nf_data_upload && new Date(pedido.nf_data_upload) >= seteDiasAtras) {
              const uploadKey = pedido.nf_data_upload.slice(0, 16); // YYYY-MM-DDTHH:MM
              notificacoesAuto.push({
                id: `nf-disponivel-${pedido.id}-${uploadKey}`,
                tipo: 'aviso',
                titulo: pedido.cliente_confirmou_nf ? 'Nota Fiscal Atualizada' : 'Nota Fiscal Disponível',
                mensagem: pedido.cliente_confirmou_nf
                  ? `A NF do pedido #${idPedido} foi atualizada pelo fornecedor.`
                  : `A NF do pedido #${idPedido} foi emitida. Confirme o recebimento.`,
                icone: 'dinheiro',
                lida: false,
                data: pedido.nf_data_upload,
                link: '/MeusPedidos',
                autogerada: true
              });
            }

            if (pedido.boleto_url && pedido.boleto_data_upload && new Date(pedido.boleto_data_upload) >= seteDiasAtras) {
              const uploadKey = pedido.boleto_data_upload.slice(0, 16);
              notificacoesAuto.push({
                id: `boleto-disponivel-${pedido.id}-${uploadKey}`,
                tipo: 'aviso',
                titulo: pedido.cliente_confirmou_boleto ? 'Boleto Atualizado' : 'Boleto Disponível',
                mensagem: pedido.cliente_confirmou_boleto
                  ? `O boleto do pedido #${idPedido} foi atualizado pelo fornecedor.`
                  : `O boleto do pedido #${idPedido} foi emitido. Confirme o recebimento.`,
                icone: 'dinheiro',
                lida: false,
                data: pedido.boleto_data_upload,
                link: '/MeusPedidos',
                autogerada: true
              });
            }
          });
        })
    );

    // Comprovante aprovado ou recusado
    tarefas.push(
      supabase.from('carteira').select(COLS_TITULO)
        .eq('cliente_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(dados)
        .then((titulosCliente) => {
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
        })
    );
  }

  // Fornecedor sem fornecedor_id nao tem pedido para ver: nao consulta nada
  // (sem o filtro, a RLS faria varrer a tabela inteira para devolver vazio).
  const fornecedorOk = isFornecedor && !!userFornecedorId;

  if (isAdmin || fornecedorOk) {
    const doFornecedor = (q) => (fornecedorOk ? q.eq('fornecedor_id', userFornecedorId) : q);
    const umDiaAtras = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);

    // Pedidos novos das ultimas 24h
    tarefas.push(
      doFornecedor(supabase.from('pedidos_resumo').select(COLS_PEDIDO).eq('status', 'novo_pedido'))
        .gte('created_date', umDiaAtras.toISOString())
        .order('created_date', { ascending: false })
        .limit(10)
        .then(dados)
        .then((pedidosNovos) => {
          pedidosNovos.forEach(pedido => {
            notificacoesAuto.push({
              id: `novo-pedido-${pedido.id}`,
              tipo: 'info',
              titulo: 'Novo Pedido Recebido',
              mensagem: `Pedido #${idCurto(pedido.id)} aguardando análise`,
              icone: 'carrinho',
              lida: false,
              data: pedido.created_date,
              link: '/PedidosFornecedor',
              autogerada: true
            });
          });
        })
    );

    // Confirmacoes do cliente (NF, boleto, recebimento) nos pedidos recentes.
    // Era esta a consulta nº 1 do banco (pedidos.* ordenado por updated_at).
    tarefas.push(
      doFornecedor(supabase.from('pedidos_resumo').select(COLS_PEDIDO))
        .order('updated_at', { ascending: false })
        .limit(20)
        .then(dados)
        .then((pedidosRecentes) => {
          pedidosRecentes.forEach(pedido => {
            const dataAtualizacao = new Date(pedido.updated_at || pedido.created_date);
            if (dataAtualizacao < seteDiasAtras) return;

            const idPedido = idCurto(pedido.id);
            const data = pedido.updated_at || pedido.created_date;

            if (pedido.cliente_confirmou_nf) {
              notificacoesAuto.push({
                id: `confirmou-nf-${pedido.id}`,
                tipo: 'sucesso',
                titulo: 'NF Confirmada pelo Cliente',
                mensagem: `Cliente confirmou recebimento da NF do pedido #${idPedido}`,
                icone: 'sucesso',
                lida: false,
                data,
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
                data,
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
                data,
                link: '/PedidosFornecedor',
                autogerada: true
              });
            }
          });
        })
    );

    // Comprovantes pendentes de análise (individual por título)
    tarefas.push(
      doFornecedor(supabase.from('carteira').select(COLS_TITULO).eq('status', 'em_analise'))
        .order('created_at', { ascending: false })
        .limit(15)
        .then(dados)
        .then((comprovantesPendentes) => {
          comprovantesPendentes.forEach(titulo => {
            const uploadKey = titulo.comprovante_data_upload ? titulo.comprovante_data_upload.slice(0, 16) : '';
            const valorStr = titulo.valor ? `R$ ${titulo.valor.toFixed(2)}` : '';
            const pedidoRef = titulo.pedido_id ? `#${idCurto(titulo.pedido_id)}` : '';
            notificacoesAuto.push({
              id: `comprovante-recebido-${titulo.id}-${uploadKey}`,
              tipo: 'aviso',
              titulo: 'Comprovante de Pagamento Recebido',
              mensagem: `Cliente enviou comprovante${pedidoRef ? ` do pedido ${pedidoRef}` : ''}${valorStr ? ` (${valorStr})` : ''}. Aguardando análise.`,
              icone: 'dinheiro',
              lida: false,
              data: titulo.comprovante_data_upload || titulo.updated_at || new Date().toISOString(),
              link: '/CarteiraFinanceira',
              autogerada: true
            });
          });
        })
    );
  }

  // Estoque baixo / sem estoque (so admin). Filtrado no servidor: antes baixava
  // a tabela de produtos inteira (2,7 MB) a cada minuto para mostrar 5 itens.
  // A tabela nao tem estoque_minimo; o limite efetivo sempre foi 5.
  if (isAdmin) {
    const COLS_PRODUTO = 'id,nome,estoque_atual_grades';
    tarefas.push(
      supabase.from('produtos').select(COLS_PRODUTO)
        .eq('disponibilidade', 'pronta_entrega')
        .gt('estoque_atual_grades', 0)
        .lte('estoque_atual_grades', 5)
        .limit(5)
        .then(dados)
        .then((produtos) => {
          produtos.forEach(produto => {
            notificacoesAuto.push({
              id: `estoque-baixo-${produto.id}`,
              tipo: 'aviso',
              titulo: 'Estoque Baixo',
              mensagem: `${produto.nome} está com estoque baixo (${produto.estoque_atual_grades || 0} un.)`,
              icone: 'estoque',
              lida: false,
              data: new Date().toISOString(),
              link: '/GestaoEstoque',
              autogerada: true
            });
          });
        })
    );
    tarefas.push(
      supabase.from('produtos').select(COLS_PRODUTO)
        .eq('disponibilidade', 'pronta_entrega')
        .eq('ativo', true)
        .or('estoque_atual_grades.eq.0,estoque_atual_grades.is.null')
        .limit(3)
        .then(dados)
        .then((produtos) => {
          produtos.forEach(produto => {
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
        })
    );
  }

  const resultados = await Promise.allSettled(tarefas);
  resultados
    .filter(r => r.status === 'rejected')
    .forEach(r => console.warn('Notificações: uma das consultas falhou', r.reason?.message || r.reason));

  return notificacoesAuto;
}

export default function NotificacoesDropdown({ userId, userRole, userTipoNegocio, userFornecedorId }) {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const ultimaCargaRef = useRef(0);
  const carregandoRef = useRef(false);
  const navigate = useNavigate();

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

  const loadNotificacoes = useCallback(async () => {
    if (!userId || carregandoRef.current) return;
    carregandoRef.current = true;
    ultimaCargaRef.current = Date.now();
    try {
      setLoading(true);

      const [notificacoesUsuario, notificacoesAutomaticas] = await Promise.all([
        Notificacao.filter({ usuario_id: userId }, '-created_at', 50).catch(() => []),
        gerarNotificacoesAutomaticas({ userId, userRole, userTipoNegocio, userFornecedorId })
      ]);

      // Filtrar auto-geradas que já foram dispensadas (persistido no localStorage)
      const dismissed = getDismissedIds(userId);
      const autoFiltradas = notificacoesAutomaticas.filter(n => !dismissed[n.id]);

      // Combinar e ordenar por data
      const todasNotificacoes = [...notificacoesUsuario, ...autoFiltradas]
        .sort((a, b) => parseAsUTC(b.created_at || b.data) - parseAsUTC(a.created_at || a.data));

      setNotificacoes(todasNotificacoes);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      carregandoRef.current = false;
      setLoading(false);
    }
  }, [userId, userRole, userTipoNegocio, userFornecedorId]);

  // Polling de 5 min, pausado com a aba escondida. Ao voltar para a aba,
  // recarrega se a ultima carga passou do intervalo.
  useEffect(() => {
    if (!userId) return undefined;

    let timer = null;
    const parar = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const iniciar = () => {
      parar();
      timer = setInterval(loadNotificacoes, INTERVALO_MS);
    };
    const aoMudarVisibilidade = () => {
      if (document.hidden) {
        parar();
        return;
      }
      if (Date.now() - ultimaCargaRef.current >= INTERVALO_MS) loadNotificacoes();
      iniciar();
    };

    loadNotificacoes();
    if (!document.hidden) iniciar();
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [userId, loadNotificacoes]);

  // Abrir o sino com dados de mais de 1 min recarrega (com 5 min de intervalo,
  // quem abre o sino quer ver o que acabou de acontecer).
  const alternarAberto = () => {
    const abrindo = !isOpen;
    setIsOpen(abrindo);
    if (abrindo && Date.now() - ultimaCargaRef.current > 60 * 1000) loadNotificacoes();
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
        onClick={alternarAberto}
        aria-label="Notificações"
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
          <div className="max-h-96 overflow-y-auto">
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
                      // So caminho interno: um link vindo do banco nunca pode
                      // ser javascript: ou outro dominio (diagnostico C4).
                      if (linkInternoSeguro(notificacao.link)) {
                        setIsOpen(false);
                        navigate(notificacao.link);
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
                          {formatDistanceToNow(parseAsUTC(notificacao.data || notificacao.created_at), {
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
          </div>

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
