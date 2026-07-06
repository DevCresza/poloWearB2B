import { useEffect, useMemo, useState } from 'react';
import { User, Capsula, Produto, Loja, Pedido, Carteira, Fornecedor } from '@/api/entities';
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
import { getPrecoGrade, getPrecoPeca } from '@/utils/precoCliente';
import { formatCurrency } from '@/utils/exportUtils';

// Expande a capsula em itens de pedido, respeitando o tipo_negocio do
// user destinatario (franqueado vs multimarca). Preco vem de getPrecoGrade
// ou getPrecoPeca. Variantes com quantidade 0 sao IGNORADAS.
function expandirCapsulaEmItens(capsula, produtos, userDaLoja, capsulaQtd = 1) {
  let pq = {};
  try {
    pq = typeof capsula.produtos_quantidades === 'string'
      ? JSON.parse(capsula.produtos_quantidades)
      : (capsula.produtos_quantidades || {});
  } catch { pq = {}; }

  const produtoIds = capsula.produto_ids || [];
  return produtoIds.flatMap(pid => {
    const produto = produtos.find(p => p.id === pid);
    if (!produto) return [];
    const config = pq[pid];
    const tipoVenda = produto.tipo_venda || 'avulso';
    const isGrade = tipoVenda === 'grade';
    const pecasGrade = parseInt(produto.total_pecas_grade) || 1;
    const precoPeca = getPrecoPeca(produto, userDaLoja);
    const precoGrade = getPrecoGrade(produto, userDaLoja);

    if (config && typeof config === 'object' && Array.isArray(config.variantes)) {
      return config.variantes
        .map(v => {
          const numGrades = (Number(v.quantidade) || 0) * capsulaQtd;
          if (numGrades <= 0) return null;
          const precoSalvo = isGrade ? precoGrade : precoPeca;
          return {
            produto_id: pid,
            nome: produto.nome,
            marca: produto.marca || '',
            referencia: produto.referencia_polo || produto.referencia_fornecedor || '',
            referencia_fornecedor: produto.referencia_fornecedor || '',
            referencia_linx: produto.referencia_polo || '',
            tipo_venda: tipoVenda,
            quantidade: numGrades,
            total_pecas_grade: pecasGrade,
            preco: precoSalvo,
            total: precoSalvo * numGrades,
            foto: null,
            grade_selecionada: null,
            cor_selecionada: { cor_nome: v.cor_nome, cor_codigo_hex: v.cor_hex || '#000000' },
            origem_capsula: capsula.id
          };
        })
        .filter(Boolean);
    }

    const qtdSimples = (typeof config === 'number' ? config : 0) * capsulaQtd;
    if (qtdSimples <= 0) return [];
    const precoSimples = isGrade ? precoGrade : precoPeca;
    return [{
      produto_id: pid,
      nome: produto.nome,
      marca: produto.marca || '',
      referencia: produto.referencia_polo || produto.referencia_fornecedor || '',
      referencia_fornecedor: produto.referencia_fornecedor || '',
      referencia_linx: produto.referencia_polo || '',
      tipo_venda: tipoVenda,
      quantidade: qtdSimples,
      total_pecas_grade: pecasGrade,
      preco: precoSimples,
      total: precoSimples * qtdSimples,
      foto: null,
      grade_selecionada: null,
      cor_selecionada: null,
      origem_capsula: capsula.id
    }];
  });
}

export default function EmissaoLote() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [capsulas, setCapsulas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [users, setUsers] = useState([]);

  const [capsulaId, setCapsulaId] = useState(null);
  const [qtdCapsula, setQtdCapsula] = useState(1);
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
        if (currentUser?.role !== 'admin') {
          toast.error('Acesso restrito ao administrador.');
          setLoading(false);
          return;
        }
        setMe(currentUser);

        const [cs, ps, fs, ls, us] = await Promise.all([
          Capsula.list(),
          Produto.list(),
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
        setProdutos(ps || []);
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
        const pedidos = await Pedido.list({ sort: '-created_date' });
        const set = new Set();
        (pedidos || []).forEach(p => {
          const temItemDaCapsula = Array.isArray(p.itens) && p.itens.some(it => it.origem_capsula === capsulaId);
          if (temItemDaCapsula && p.status !== 'cancelado') {
            set.add(`${p.comprador_user_id}::${p.loja_id || ''}`);
          }
        });
        setPedidosExistentes(set);
      } catch { setPedidosExistentes(new Set()); }
    })();
  }, [capsulaId]);

  const capsulaSelecionada = useMemo(
    () => capsulas.find(c => c.id === capsulaId) || null,
    [capsulas, capsulaId]
  );

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
    if (!confirm(`Emitir a cápsula "${capsulaSelecionada.nome}" (${qtdCapsula}x) para ${selectedLojaIds.size} loja(s)?`)) return;

    setEmitindo(true);
    const relatorio = { sucesso: [], falha: [] };

    // Fornecedor da capsula (opcional, usado pra info)
    const fornecedor = fornecedores.find(f => f.id === capsulaSelecionada.fornecedor_id) || null;

    for (const { loja, dono } of lojasVisiveis) {
      if (!selectedLojaIds.has(loja.id)) continue;
      try {
        // Validacoes de endereco
        if (!loja.endereco_completo || !loja.cep || !loja.cidade || !loja.estado) {
          relatorio.falha.push({ loja, motivo: 'Loja sem endereço completo' });
          continue;
        }

        const itens = expandirCapsulaEmItens(capsulaSelecionada, produtos, dono, qtdCapsula);
        if (itens.length === 0) {
          relatorio.falha.push({ loja, motivo: 'Cápsula não gerou itens (todas cores em 0)' });
          continue;
        }
        const total = itens.reduce((s, it) => s + (it.total || 0), 0);
        if (total <= 0) {
          relatorio.falha.push({ loja, motivo: 'Total zerado' });
          continue;
        }

        const enderecoEntrega = {
          endereco: loja.endereco_completo,
          cep: loja.cep,
          cidade: loja.cidade,
          estado: loja.estado,
          destinatario: loja.nome_fantasia || loja.nome,
          telefone: loja.telefone || dono.telefone || dono.whatsapp
        };

        const pedidoData = {
          comprador_user_id: dono.id,
          fornecedor_id: capsulaSelecionada.fornecedor_id || null,
          loja_id: loja.id,
          itens,
          valor_total: total,
          valor_final: total,
          status: 'novo_pedido',
          status_pagamento: 'pendente',
          metodo_pagamento: metodoPagamento,
          endereco_entrega: enderecoEntrega,
          observacoes: observacoes || `Emissão em lote pela administração — ${capsulaSelecionada.nome}`,
          observacoes_comprador: observacoes || '',
          estoque_baixado: false, // admin emitindo em nome do cliente — nao dar baixa automatica
          emitido_por_admin_user_id: me?.id || null,
        };

        const pedido = await Pedido.create(pedidoData);

        // Placeholder na carteira mantido pra compatibilidade com fluxo normal
        // (fornecedor cria as parcelas reais depois no faturamento).
        try {
          const dv = new Date();
          dv.setDate(dv.getDate() + 30);
          await Carteira.create({
            pedido_id: pedido.id,
            cliente_user_id: dono.id,
            loja_id: loja.id,
            tipo: 'a_pagar',
            descricao: `Pedido #${pedido.id.slice(-8).toUpperCase()} - ${capsulaSelecionada.nome}`,
            valor: total,
            data_vencimento: dv.toISOString().split('T')[0],
            status: 'pendente',
            categoria: 'Pedido'
          });
        } catch (cerr) {
          console.warn('Placeholder de carteira falhou (nao bloqueia):', cerr);
        }

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
  if (!me || me.role !== 'admin') {
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

          {capsulaSelecionada && (
            <div className="bg-white p-3 rounded-lg border text-sm space-y-1">
              <div><span className="font-semibold">Cápsula:</span> {capsulaSelecionada.nome}</div>
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
