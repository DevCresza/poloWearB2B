-- Meses de calendario em que a capsula pode ser entregue/faturada.
-- Array de 'YYYY-MM' (ex: ["2026-08","2026-09"]). O admin escolhe no cadastro
-- da capsula; no checkout o cliente escolhe UM desses meses (se so tiver um,
-- vai fixo). O mes escolhido vira o mes de entrega/faturamento do pedido.
alter table public.capsulas add column if not exists meses_disponiveis jsonb default '[]'::jsonb;
