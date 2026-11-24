// Datas no horario de Brasilia (America/Sao_Paulo).
//
// O banco grava created_date, nf_data_upload etc. como `timestamp` SEM fuso,
// em UTC. O JS le "2026-10-31T23:30:00" (sem o Z) como hora LOCAL -- e
// `new Date().toISOString().split('T')[0]` devolve a data UTC, que depois das
// 21h em Brasilia ja e o dia seguinte. Estes helpers fazem a conta certa em
// qualquer fuso do navegador, com a mesma regra das funcoes SQL data_br() /
// hoje_br() (migration *_t15_relatorios_fuso_e_pecas.sql).

const FUSO = 'America/Sao_Paulo';

// en-CA formata como YYYY-MM-DD.
const fmtData = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
});

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;
// Timestamp sem fuso: sem 'Z' e sem '+hh:mm' / '-hh:mm' no fim.
const SEM_FUSO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
// Meia-noite exata: data digitada pelo usuario e gravada como
// 'YYYY-MM-DDT00:00:00' (ex.: data de emissao da NF). E uma DATA, nao um
// instante -- nao se converte de fuso.
const MEIA_NOITE = /^(\d{4}-\d{2}-\d{2})[T ]00:00(:00(\.0+)?)?$/;

/**
 * Converte o valor em instante (Date). Strings de timestamp sem fuso vindas do
 * banco sao UTC. Devolve null se invalido.
 */
const paraInstante = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number') return new Date(valor);
  const s = String(valor).trim();
  const d = SEM_FUSO.test(s) ? new Date(`${s.replace(' ', 'T')}Z`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * 'YYYY-MM-DD' no horario de Brasilia.
 *   dataBR()                      -> hoje em Brasilia
 *   dataBR('2026-10-31')          -> '2026-10-31' (data pura nao muda)
 *   dataBR('2026-10-31T00:00:00') -> '2026-10-31' (meia-noite = data digitada)
 *   dataBR('2026-11-01T01:30:00') -> '2026-10-31' (UTC do banco -> 22h30 em Brasilia)
 *   dataBR(new Date())            -> data do instante em Brasilia
 */
export const dataBR = (valor = new Date()) => {
  if (typeof valor === 'string') {
    const s = valor.trim();
    if (SO_DATA.test(s)) return s;
    const m = MEIA_NOITE.exec(s);
    if (m) return m[1];
  }
  const d = paraInstante(valor);
  return d ? fmtData.format(d) : '';
};

/** Hoje ('YYYY-MM-DD') no horario de Brasilia. Substitui `toISOString().split('T')[0]`. */
export const hojeBR = () => dataBR(new Date());

/** Mes ('YYYY-MM') no horario de Brasilia. Sem argumento, o mes corrente. */
export const mesBR = (valor = new Date()) => {
  const d = dataBR(valor);
  return d ? d.slice(0, 7) : '';
};

/** { ano, mes } (numeros, mes 1-12) correntes em Brasilia. */
export const anoMesBR = () => {
  const [ano, mes] = mesBR().split('-').map(Number);
  return { ano, mes };
};

/** Soma dias a uma data 'YYYY-MM-DD' (sem passar por fuso). */
export const somarDiasISO = (iso, dias) => {
  const [a, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
};

/** Ultimo dia ('YYYY-MM-DD') do mes `mes` (1-12) de `ano`. */
export const ultimoDiaDoMesISO = (ano, mes) =>
  new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

/**
 * Agora como timestamp UTC sem fuso ('YYYY-MM-DDTHH:mm:ss.SSS'), no mesmo
 * referencial das colunas do banco.
 */
export const agoraUTCsemFuso = () => new Date().toISOString().slice(0, 23);
