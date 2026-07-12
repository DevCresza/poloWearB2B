import { useState, useMemo } from 'react';
import { Users, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useRepresentacao } from '@/contexts/RepresentacaoContext';
import { getPapel, LABELS_PAPEL } from '@/utils/roles';

/**
 * Escolhe em nome de QUAL cliente o vendedor esta comprando.
 * Trocar de cliente troca o carrinho e os precos automaticamente
 * (o carrinhoKey muda e o Catalogo/Carrinho recarregam).
 */
export default function SeletorClienteAlvo() {
  const { isVendedor, clientes, clienteAlvo, setClienteAlvo } = useRepresentacao();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes.slice(0, 50);
    return clientes.filter(c =>
      (c.empresa || '').toLowerCase().includes(q)
      || (c.full_name || '').toLowerCase().includes(q)
      || (c.cnpj || '').toLowerCase().includes(q)
      || (c.cidade || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [clientes, busca]);

  if (!isVendedor) return null;

  const nomeCliente = clienteAlvo
    ? (clienteAlvo.empresa || clienteAlvo.full_name || 'Cliente')
    : null;

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={clienteAlvo ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-blue-400 text-blue-700'}
        >
          <Users className="w-4 h-4 mr-2" />
          <span className="max-w-[160px] truncate">
            {nomeCliente || 'Escolher cliente'}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprar em nome de qual cliente?</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            autoFocus
            placeholder="Buscar por empresa, nome, CNPJ ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {clienteAlvo && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-red-600 hover:bg-red-50"
            onClick={() => { setClienteAlvo(null); setAberto(false); }}
          >
            <X className="w-4 h-4 mr-2" />
            Sair da representação
          </Button>
        )}

        <div className="max-h-80 overflow-y-auto divide-y">
          {filtrados.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">Nenhum cliente encontrado.</p>
          )}
          {filtrados.map(c => {
            const papel = getPapel(c);
            const selecionado = clienteAlvo?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setClienteAlvo(c); setAberto(false); }}
                className={`w-full text-left px-3 py-3 hover:bg-slate-50 ${selecionado ? 'bg-amber-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 truncate">
                    {c.empresa || c.full_name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.bloqueado && <Badge className="bg-red-100 text-red-700">Bloqueado</Badge>}
                    <Badge variant="outline">{LABELS_PAPEL[papel] || papel}</Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {[c.cnpj, c.cidade, c.estado].filter(Boolean).join(' • ') || 'Sem dados de empresa'}
                </p>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Faixa fixa lembrando em nome de quem o vendedor esta comprando. */
export function FaixaRepresentacao() {
  const { isVendedor, clienteAlvo } = useRepresentacao();
  if (!isVendedor) return null;

  if (!clienteAlvo) {
    return (
      <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Escolha um cliente no topo da tela para ver o catálogo com os preços dele e montar o pedido.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-2">
      <Users className="w-4 h-4 shrink-0" />
      <span>
        Você está comprando em nome de{' '}
        <strong>{clienteAlvo.empresa || clienteAlvo.full_name}</strong>
        {clienteAlvo.cidade ? ` (${clienteAlvo.cidade})` : ''}.
      </span>
      {clienteAlvo.bloqueado && (
        <Badge className="bg-red-100 text-red-700 ml-auto shrink-0">Cliente bloqueado</Badge>
      )}
    </div>
  );
}
