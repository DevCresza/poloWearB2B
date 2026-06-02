import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Mail, Search, CheckCircle, AlertTriangle, Filter, Eye, ExternalLink, Loader2
} from 'lucide-react';
import { formatDateTime } from '@/utils/exportUtils';

// Mapeamento event_key → rótulo amigável + cor do badge.
// event_key dos comprovantes tem o id da carteira no fim ('comprovante:uploaded:UUID');
// por isso usamos prefixos para casamento.
const EVENTOS = [
  { prefix: 'pedido_criado', label: 'Pedido recebido', color: 'bg-blue-100 text-blue-800' },
  { prefix: 'status:em_producao', label: 'Pedido aceito', color: 'bg-blue-100 text-blue-800' },
  { prefix: 'status:faturado', label: 'Faturado', color: 'bg-indigo-100 text-indigo-800' },
  { prefix: 'status:em_transporte', label: 'Em transporte', color: 'bg-orange-100 text-orange-800' },
  { prefix: 'status:entregue', label: 'Entregue', color: 'bg-green-100 text-green-800' },
  { prefix: 'status:cancelado', label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  { prefix: 'pagamento:pago', label: 'Pagamento confirmado', color: 'bg-green-100 text-green-800' },
  { prefix: 'boleto:added', label: 'Boleto disponível', color: 'bg-purple-100 text-purple-800' },
  { prefix: 'pix:added', label: 'PIX disponível', color: 'bg-purple-100 text-purple-800' },
  { prefix: 'nf:added', label: 'Nota Fiscal disponível', color: 'bg-purple-100 text-purple-800' },
  { prefix: 'comprovante:uploaded', label: 'Comprovante enviado', color: 'bg-yellow-100 text-yellow-800' },
  { prefix: 'comprovante:aprovado', label: 'Comprovante aprovado', color: 'bg-green-100 text-green-800' },
  { prefix: 'comprovante:recusado', label: 'Comprovante recusado', color: 'bg-red-100 text-red-800' }
];

function eventoInfo(eventKey) {
  if (!eventKey) return { label: 'Desconhecido', color: 'bg-gray-100 text-gray-800' };
  const match = EVENTOS.find(e => eventKey === e.prefix || eventKey.startsWith(e.prefix + ':'));
  return match || { label: eventKey, color: 'bg-gray-100 text-gray-800' };
}

function pedidoNum(id) {
  if (!id) return '—';
  return `#${String(id).slice(-8).toUpperCase()}`;
}

export default function HistoricoEmails() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('30d');
  const [filtroEvento, setFiltroEvento] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [emailSelecionado, setEmailSelecionado] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await User.me();
        // Acesso restrito: admin e fornecedor
        if (me.role !== 'admin' && me.tipo_negocio !== 'admin' && me.tipo_negocio !== 'fornecedor') {
          navigate('/PortalDashboard', { replace: true });
          return;
        }
        setUser(me);

        // RLS faz o filtro automático. Admin vê tudo, fornecedor só vê os pedidos dele.
        const { data, error } = await supabase
          .from('pedido_notifications_sent')
          .select('*')
          .order('sent_at', { ascending: false })
          .limit(1000);
        if (error) throw error;
        setEmails(data || []);
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const emailsFiltrados = useMemo(() => {
    return (emails || []).filter(e => {
      // período
      if (filtroPeriodo !== 'all') {
        const dias = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }[filtroPeriodo] || 30;
        const cutoff = Date.now() - dias * 86400000;
        if (new Date(e.sent_at).getTime() < cutoff) return false;
      }
      // evento
      if (filtroEvento !== 'all') {
        const matched = e.event_key === filtroEvento || e.event_key?.startsWith(filtroEvento + ':');
        if (!matched) return false;
      }
      // status
      const enviou = !!e.resend_message_id;
      if (filtroStatus === 'ok' && !enviou) return false;
      if (filtroStatus === 'erro' && enviou) return false;
      // busca
      if (busca) {
        const q = busca.toLowerCase();
        const inEmail = e.recipient?.toLowerCase().includes(q);
        const inPedido = e.pedido_id?.toLowerCase().includes(q);
        const inAssunto = e.payload_summary?.subject?.toLowerCase().includes(q);
        if (!inEmail && !inPedido && !inAssunto) return false;
      }
      return true;
    });
  }, [emails, filtroPeriodo, filtroEvento, filtroStatus, busca]);

  const stats = useMemo(() => {
    const total = emailsFiltrados.length;
    const ok = emailsFiltrados.filter(e => e.resend_message_id).length;
    const erro = total - ok;
    return { total, ok, erro };
  }, [emailsFiltrados]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando histórico de e-mails…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-blue-600" />
            Histórico de E-mails
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {user?.tipo_negocio === 'fornecedor'
              ? 'Notificações enviadas para os clientes dos seus pedidos.'
              : 'Todas as notificações transacionais enviadas pelo portal.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-2 bg-white">
            <p className="text-xs text-gray-500">Total filtrado</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </Card>
          <Card className="px-4 py-2 bg-white">
            <p className="text-xs text-gray-500">Entregues à Resend</p>
            <p className="text-xl font-bold text-green-700">{stats.ok}</p>
          </Card>
          {stats.erro > 0 && (
            <Card className="px-4 py-2 bg-white">
              <p className="text-xs text-gray-500">Com erro</p>
              <p className="text-xl font-bold text-red-700">{stats.erro}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por e-mail, pedido ou assunto…"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ok">Entregues à Resend</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 self-center mr-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Evento:
            </span>
            <Button
              size="sm"
              variant={filtroEvento === 'all' ? 'default' : 'outline'}
              onClick={() => setFiltroEvento('all')}
              className="h-7 text-xs"
            >
              Todos
            </Button>
            {EVENTOS.map(ev => (
              <Button
                key={ev.prefix}
                size="sm"
                variant={filtroEvento === ev.prefix ? 'default' : 'outline'}
                onClick={() => setFiltroEvento(ev.prefix)}
                className="h-7 text-xs"
              >
                {ev.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{emailsFiltrados.length} e-mail(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {emailsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum e-mail encontrado com esses filtros.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {emailsFiltrados.map(email => {
                const info = eventoInfo(email.event_key);
                const enviou = !!email.resend_message_id;
                return (
                  <div
                    key={email.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-start gap-3"
                    onClick={() => setEmailSelecionado(email)}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {enviou ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge className={info.color}>{info.label}</Badge>
                        {email.pedido_id && (
                          <span className="text-xs text-gray-500">Pedido {pedidoNum(email.pedido_id)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {email.payload_summary?.subject || 'Sem assunto registrado'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Para: {email.recipient}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-gray-500">{formatDateTime(email.sent_at)}</p>
                      {!enviou && (
                        <p className="text-xs text-red-600 font-medium mt-1">Falhou</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!emailSelecionado} onOpenChange={(open) => !open && setEmailSelecionado(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Detalhes do e-mail
            </DialogTitle>
          </DialogHeader>
          {emailSelecionado && (() => {
            const info = eventoInfo(emailSelecionado.event_key);
            const enviou = !!emailSelecionado.resend_message_id;
            const erro = emailSelecionado.payload_summary?.send_error;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={info.color}>{info.label}</Badge>
                  {enviou ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Entregue à Resend
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Falhou
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Para</p>
                    <p className="font-medium text-gray-900 break-all">{emailSelecionado.recipient}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Quando</p>
                    <p className="font-medium text-gray-900">{formatDateTime(emailSelecionado.sent_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pedido</p>
                    <p className="font-medium text-gray-900">{pedidoNum(emailSelecionado.pedido_id)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Evento</p>
                    <p className="font-medium text-gray-900 break-all">{emailSelecionado.event_key}</p>
                  </div>
                </div>

                {emailSelecionado.payload_summary?.subject && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Assunto</p>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded">
                      {emailSelecionado.payload_summary.subject}
                    </p>
                  </div>
                )}

                {emailSelecionado.resend_message_id && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Resend message ID</p>
                    <p className="text-xs font-mono text-gray-700 bg-gray-50 p-2 rounded break-all">
                      {emailSelecionado.resend_message_id}
                    </p>
                  </div>
                )}

                {!enviou && erro && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Erro retornado pela Resend</p>
                    <pre className="text-xs bg-red-50 p-3 rounded border border-red-200 overflow-x-auto text-red-900">
                      {typeof erro === 'string' ? erro : JSON.stringify(erro, null, 2)}
                    </pre>
                  </div>
                )}

                {emailSelecionado.pedido_id && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const destino = user?.tipo_negocio === 'fornecedor' ? '/PedidosFornecedor' : '/PedidosAdmin';
                        navigate(destino);
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ir para a tela de pedidos
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
