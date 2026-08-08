import { useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Campo de quantidade digitável, para usar entre os botões -/+.
 *
 * Existe porque pedido grande era feito no clique: 500 peças = 500 cliques na
 * setinha. Aqui dá pra clicar no número e digitar.
 *
 * O rascunho local é necessário quando há mínimo: travando o valor a cada
 * tecla, quem quer 20 num produto de mínimo 4 digita "2", vira "4" na hora e
 * nunca chega no 20. O texto fica livre durante a edição e só é normalizado
 * ao sair do campo (blur/Enter).
 *
 * Precisa ser declarado fora do componente que renderiza — se for criado
 * dentro do render, cada tecla remonta o input e o cursor pula fora.
 */
export default function CampoQuantidade({
  valor,
  minimo = 0,
  maximo,
  onCommit,
  titulo,
  disabled = false,
  className = 'w-14 h-7 px-1 text-center font-semibold tabular-nums'
}) {
  const [rascunho, setRascunho] = useState(null);

  const confirmar = () => {
    if (rascunho === null) return;
    const num = parseInt(rascunho, 10);
    let final = Number.isFinite(num) ? num : minimo;
    if (final < minimo) final = minimo;
    if (typeof maximo === 'number' && final > maximo) final = maximo;
    onCommit(final);
    setRascunho(null);
  };

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={minimo}
      max={maximo}
      title={titulo}
      disabled={disabled}
      value={rascunho ?? valor}
      onChange={(e) => setRascunho(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={confirmar}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={className}
    />
  );
}
