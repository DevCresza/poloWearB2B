-- Campo "Acao" no produto: rotulo livre que o admin define (Caps 1, Caps 2,
-- Black Friday, Continuo, Promocao...). Some no relatorio detalhado para o
-- admin filtrar/somar por capsula/acao — a mesma "coluna ACAO" da planilha.
-- Texto livre (Bruno cria a vontade); no formulario sugerimos os valores ja
-- usados para nao virar "CAPS2" vs "Caps 2".
alter table public.produtos add column if not exists acao varchar(60);
create index if not exists idx_produtos_acao on public.produtos (acao);
