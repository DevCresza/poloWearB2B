import { useEffect, useMemo, useState } from 'react';
import { User, Capsula, Loja, Fornecedor } from '@/api/entities';
import { emitirPedidoLote, novaChaveEnvio } from '@/api/pedidos';
import { can, PERM } from '@/utils/permissoes';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { AlertTriangle, Store, Package, Search, Send, CheckCircle, XCircle, Filter } from 'lucide-react';
import { formatCurrency } from '@/utils/exportUtils';

// Pedidos não cancelados que já têm algum item desta cápsula -- só comprador
// e loja. O filtro jsonb (@>) roda no servidor; a paginação é porque o
// PostgREST corta em 1000 linhas por requisição.
async function pedidosComItemDaCapsula(capsulaId) {
  const PAGINA = 1000;
  let todos = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('comprador_user_id,loja_id')
      .neq('status', 'cancelado')
      .contains('itens', JSON.stringify([{ origem_capsula: capsulaId }]))
      .order('id')
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw error;
    todos = todos.concat(data || []);
    if (!data || data.length < PAGINA) return todos;
  }
}

export default function EmissaoLote() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [capsulas, setCapsulas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [users, setUsers] = useState([]);

  const [capsulaId, setCapsulaId] = useState(null);
  const [qtdCapsula, setQtdCapsula] = useState(1);
  const [mesEntrega, setMesEntrega] = useState(null); // 'YYYY-MM' escolhido para a capsula
  const [selectedLojaIds, setSelectedLojaIds] = useState(new Set());
  const [observacoes, setObservacoes] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('boleto_faturado');

  const [filtroTipo, setFiltroTipo] = useState('franqueado');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [ocultarComPedido, setOcultarComPedido] = useState(true);

  const [pedidosExistentes, setPedidosExistentes] = useState(new Set()); // key = user_id::capsula_id::loja_id
  const [resultados, setResultados] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await User.me();
        if (!can(currentUser, PERM.EMITIR_LOTE)) {
          toast.error('Acesso restrito ao administrador.');
          setLoading(false);
          return;
        }
        setMe(currentUser);

        // Produtos nao vem mais para a tela: itens e precos sao montados no
        // servidor (emitir_pedido_lote).
        const [cs, fs, ls, us] = await Promise.all([
          Capsula.list(),
          Fornecedor.list(),
          Loja.list(),
          User.list()
        ]);
        const cAtivas = (cs || []).filter(c => c.ativa);
        cAtivas.sort((a, b) => {
          const oa = Number(a.ordem_exibicao) || 0;
          const ob = Number(b.ordem_exibicao) || 0;
          if (oa !== ob) return oa - ob;
          return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });
        setCapsulas(cAtivas);
        setFornecedores(fs || []);
        setLojas(ls || []);
        setUsers(us || []);
      } catch (e) {
        toast.error('Erro ao carregar dados: ' + (e?.message || ''));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Ao selecionar capsula, verifica quais lojas ja tem pedido dela (evita duplicar)
  useEffect(() => {
    (async () => {
      if (!capsulaId) { setPedidosExistentes(new Set()); return; }
      try {
        // Antes baixava pedidos.* inteiro (~78 MB, com o itens) a cada cápsula
        // escolhida, para olhar o itens aqui. Agora o banco filtra (itens
        // contém um item com esta origem_capsula, status não cancelado) e
        // devolve só as duas colunas da chave.
        const pedidos = await pedidosComItemDaCapsula(capsulaId);
        const set = new Set();
        (pedidos || []).forEach(p => {
          set.add(`${p.comprador_user_id}::${p.loja_id || ''}`);
        });
        setPedidosExistentes(set);
      } catch { setPedidosExistentes(new Set()); }
    })();
  }, [capsulaId]);

  const capsulaSelecionada = useMemo(
    () => capsulas.find(c => c.id === capsulaId) || null,
    [capsulas, capsulaId]
  );

  const mesesDaCapsula = useMemo(
    () => (Array.isArray(capsulaSelecionada?.meses_disponiveis) ? capsulaSelecionada.meses_disponiveis : []),
    [capsulaSelecionada]
  );

  // Ao trocar de capsula: se ela tem exatamente um mes, ja fixa; senao zera
  // para o admin escolher (nao herdar o mes de outra capsula).
  useEffect(() => {
    setMesEntrega(mesesDaCapsula.length === 1 ? mesesDaCapsula[0] : null);
  }, [capsulaId, mesesDaCapsula]);

  const rotuloMes = (mes) => {
    if (!mes) return '';
    const [ano, m] = mes.split('-').map(Number);
    return new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const usersById = useMemo(() => {
    const m = new Map();
    (users || []).forEach(u => m.set(u.id, u));
    return m;
  }, [users]);

  // Lojas visiveis conforme filtros
  const lojasVisiveis = useMemo(() => {
    if (!capsulaSelecionada) return [];
    const termo = filtroBusca.trim().toLowerCase();
    return (lojas || [])
      .map(l => ({ loja: l, dono: usersById.get(l.user_id) || null }))
      .filter(({ loja, dono }) => {
        if (!dono) return false;
        if (filtroTipo !== 'todos' && dono.tipo_negocio !== filtroTipo) return false;
        if (dono.ativo === false) return false;
        // capsula disponivel pro tipo?
        if (dono.tipo_negocio === 'multimarca' && capsulaSelecionada.disponivel_multimarca !== true) return false;
        if (dono.tipo_negocio === 'franqueado' && capsulaSelecionada.disponivel_franqueado === false) return false;
        if (ocultarComPedido && pedidosExistentes.has(`${dono.id}::${loja.id}`)) return false;
        if (termo) {
          const alvo = [loja.nome, loja.nome_fantasia, loja.cnpj, loja.cidade, loja.estado, dono.full_name, dono.email]
            .filter(Boolean).join(' ').toLowerCase();
          if (!alvo.includes(termo)) return false;
        }
        return true;
      });
  }, [lojas, usersById, capsulaSelecionada, filtroTipo, filtroBusca, ocultarComPedido, pedidosExistentes]);

  const toggleLoja = (id) => {
    setSelectedLojaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTodas = () => {
    const idsVisiveis = new Set(lojasVisiveis.map(({ loja }) => loja.id));
    const todasSelecionadas = lojasVisiveis.every(({ loja }) => selectedLojaIds.has(loja.id));
    if (todasSelecionadas) {
      setSelectedLojaIds(prev => {
        const next = new Set(prev);
        idsVisiveis.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedLojaIds(prev => {
        const next = new Set(prev);
        idsVisiveis.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const emitir = async () => {
    if (!capsulaSelecionada) return;
    if (selectedLojaIds.size === 0) {
      toast.info('Selecione pelo menos uma loja.');
      return;
    }
    // Capsula com varios meses exige a escolha do mes de entrega antes de emitir.
    // Sem isto, o mes cai no fallback (data do produto) e todos os lotes saem
    // no mesmo mes.
    if (mesesDaCapsula.length > 1 && !mesEntrega) {
      toast.error('Escolha o mês de entrega antes de emitir.');
      return;
    }
    const mesTexto = mesEntrega ? ` — entrega ${rotuloMes(mesEntrega)}` : '';
    if (!confirm(`Emitir a cápsula "${capsulaSelecionada.nome}" (${qtdCapsula}x)${mesTexto} para ${selectedLojaIds.size} loja(s)?`)) return;

    setEmitindo(true);
    const relatorio = { sucesso: [], falha: [] };
    // Uma chave por clique em "emitir"; cada loja vira `${chaveLote}:${loja}`.
    const chaveLote = novaChaveEnvio();

    for (const { loja, dono } of lojasVisiveis) {
      if (!selectedLojaIds.has(loja.id)) continue;
      try {
        // Validacoes de endereco
        if (!loja.endereco_completo || !loja.cep || !loja.cidade || !loja.estado) {
          relatorio.falha.push({ loja, motivo: 'Loja sem endereço completo' });
          continue;
        }

        // Itens, precos (do perfil do dono da loja), pedido e titulo provisorio
        // saem do servidor numa transacao so. A chave e deste lote + loja:
        // clicar de novo (ou repetir depois de uma falha de rede) nao duplica.
        const res = await emitirPedidoLote({
          capsulaId: capsulaSelecionada.id,
          quantidade: qtdCapsula,
          mesEntrega,
          lojaId: loja.id,
          metodoPagamento,
          observacoes,
          chave: `${chaveLote}:${loja.id}`,
        });
        const pedido = { id: res.pedido_id };
        const total = Number(res.valor_total) || 0;

        relatorio.sucesso.push({ loja, dono, pedidoId: pedido.id, valor: total });
      } catch (err) {
        relatorio.falha.push({ loja, motivo: err?.message || 'erro desconhecido' });
      }
    }

    setResultados(relatorio);
    setEmitindo(false);
    setSelectedLojaIds(new Set());
    toast.success(`Emissão concluída: ${relatorio.sucesso.length} pedido(s) criados, ${relatorio.falha.length} falha(s).`);
  };

  const fornecedorInfo = useMemo(() => {
    if (!capsulaSelecionada) return null;
    return fornecedores.find(f => f.id === capsulaSelecionada.fornecedor_id) || null;
  }, [capsulaSelecionada, fornecedores]);

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!me || !can(me, PERM.EMITIR_LOTE)) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Acesso restrito a administradores.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Emissão de Cápsula em Lote</h1>
        <p className="text-gray-600 text-sm">Emite a mesma cápsula em nome de várias lojas de uma vez (ex.: para franquias que não fecharam o pedido no prazo).</p>
      </div>

      {/* PASSO 1: Cápsula */}
      <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Package className="w-4 h-4"/>1. Escolher cápsula</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Cápsula</Label>
              <Select value={capsulaId || ''} onValueChange={setCapsulaId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma cápsula ativa" /></SelectTrigger>
                <SelectContent>
                  {capsulas.map(c => (
                    <SelectItem key={c.id} value={c.id}>#{Number(c.ordem_exibicao) || 0} — {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade de cápsulas (por loja)</Label>
              <Input
                type="number"
                min="1"
                value={qtdCapsula}
                onChange={e => setQtdCapsula(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Mes de entrega da capsula: fixo se so tiver um, senao dropdown.
              O mes vira a entrega/faturamento de todos os pedidos deste lote. */}
          {capsulaSelecionada && mesesDaCapsula.length > 0 && (
            <div>
              <Label>Mês de entrega {mesesDaCapsula.length > 1 ? '*' : ''}</Label>
              {mesesDaCapsula.length === 1 ? (
                <div className="mt-1">
                  <Badge className="bg-purple-100 text-purple-800 border border-purple-300 capitalize text-sm px-3 py-1">
                    {rotuloMes(mesesDaCapsula[0])}
                  </Badge>
                </div>
              ) : (
                <>
                  <Select value={mesEntrega || ''} onValueChange={setMesEntrega}>
                    <SelectTrigger><SelectValue placeholder="Escolha o mês de entrega" /></SelectTrigger>
                    <SelectContent>
                      {mesesDaCapsula.map(m => (
                        <SelectItem key={m} value={m} className="capitalize">{rotuloMes(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!mesEntrega && (
                    <p className="text-xs text-amber-600 mt-1">Escolha o mês para poder emitir.</p>
                  )}
                </>
              )}
            </div>
          )}

          {capsulaSelecionada && (
            <div className="bg-white p-3 rounded-lg border text-sm space-y-1">
              <div><span className="font-semibold">Cápsula:</span> {capsulaSelecionada.nome}</div>
              {mesEntrega && (
                <div><span className="font-semibold">Entrega:</span> <span className="capitalize">{rotuloMes(mesEntrega)}</span></div>
              )}
              {fornecedorInfo && (
                <div><span className="font-semibold">Fornecedor:</span> {fornecedorInfo.nome_marca || fornecedorInfo.razao_social}</div>
              )}
              <div className="text-xs text-gray-500">
                Disponível para: {capsulaSelecionada.disponivel_franqueado !== false ? 'Franqueado' : ''}
                {capsulaSelecionada.disponivel_multimarca ? (capsulaSelecionada.disponivel_franqueado !== false ? ' + Multimarca' : 'Multimarca') : ''}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PASSO 2: Lojas */}
      {capsulaSelecionada && (
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Store className="w-4 h-4"/>2. Selecionar lojas ({selectedLojaIds.size} marcadas)</CardTitle>
            <CardDescription>Marque as lojas que devem receber um pedido desta cápsula.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Filter className="w-3 h-3"/>Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="franqueado">Franqueado</SelectItem>
                    <SelectItem value="multimarca">Multimarca</SelectItem>
                    <SelectItem value="todos">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Busca</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400"/>
                  <Input value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} placeholder="Nome da loja, CNPJ, cliente, cidade..." className="pl-8" />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Checkbox id="ocultar" checked={ocultarComPedido} onCheckedChange={c => setOcultarComPedido(!!c)} />
                <Label htmlFor="ocultar" className="text-sm">Ocultar quem já tem pedido</Label>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{lojasVisiveis.length} loja(s) visível(is)</span>
              <Button variant="outline" size="sm" onClick={toggleTodas}>
                {lojasVisiveis.every(({ loja }) => selectedLojaIds.has(loja.id)) ? 'Desmarcar todas' : 'Marcar todas'}
              </Button>
            </div>

            <ScrollArea className="h-[380px] rounded border bg-white">
              <ul className="divide-y">
                {lojasVisiveis.map(({ loja, dono }) => {
                  const marcada = selectedLojaIds.has(loja.id);
                  return (
                    <li key={loja.id} className={`p-3 flex items-start gap-3 hover:bg-gray-50 ${marcada ? 'bg-blue-50' : ''}`}>
                      <Checkbox checked={marcada} onCheckedChange={() => toggleLoja(loja.id)} className="mt-1" />
                      <div className="flex-1 text-sm">
                        <div className="font-medium">
                          {loja.nome_fantasia || loja.nome}
                          {' '}
                          <Badge variant="outline" className="ml-1 text-[10px]">{dono.tipo_negocio}</Badge>
                        </div>
                        <div className="text-xs text-gray-600">
                          {loja.nome} {loja.cnpj ? ` · CNPJ ${loja.cnpj}` : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          Titular: {dono.full_name} ({dono.email})
                          {loja.cidade || loja.estado ? ` · ${loja.cidade || ''}/${loja.estado || ''}` : ''}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {lojasVisiveis.length === 0 && (
                  <li className="p-6 text-center text-sm text-gray-500">Nenhuma loja no filtro atual.</li>
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* PASSO 3: Emitir */}
      {capsulaSelecionada && (
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Send className="w-4 h-4"/>3. Confirmar emissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Forma de pagamento (aplicada a todos)</Label>
                <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto_faturado">Boleto Faturado</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="a_vista">À Vista</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: Pedido mínimo automático — coleção não retirada no prazo" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button disabled={emitindo || selectedLojaIds.size === 0} onClick={emitir} className="bg-blue-600 hover:bg-blue-700">
                <Send className="w-4 h-4 mr-2" />
                {emitindo ? 'Emitindo...' : `Emitir ${selectedLojaIds.size} pedido(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {resultados && (
        <Card className="bg-slate-100 rounded-2xl shadow-neumorphic">
          <CardHeader>
            <CardTitle className="text-base">Resultado da emissão</CardTitle>
            <CardDescription>{resultados.sucesso.length} sucesso(s) · {resultados.falha.length} falha(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resultados.sucesso.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                  <CheckCircle className="w-4 h-4" /> Pedidos criados
                </div>
                <ul className="text-sm space-y-1 max-h-[220px] overflow-auto bg-white rounded border p-2">
                  {resultados.sucesso.map(s => (
                    <li key={s.pedidoId}>#{s.pedidoId.slice(-8).toUpperCase()} — {s.loja.nome_fantasia || s.loja.nome} — {formatCurrency(s.valor)}</li>
                  ))}
                </ul>
              </div>
            )}
            {resultados.falha.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                  <XCircle className="w-4 h-4" /> Falhas
                </div>
                <ul className="text-sm space-y-1 max-h-[220px] overflow-auto bg-white rounded border p-2">
                  {resultados.falha.map((f, i) => (
                    <li key={i}>{f.loja.nome_fantasia || f.loja.nome} — {f.motivo}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
