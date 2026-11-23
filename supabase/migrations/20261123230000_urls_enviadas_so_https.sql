-- T13 / M14: URL de arquivo enviado (comprovante, boleto, NF) só pode ser https.
--
-- O front abre essas URLs numa aba nova (abrirUrlSegura, src/utils/urlSegura.js).
-- Esta trava garante no banco que ninguém grava javascript:, data: ou http: nelas,
-- inclusive pelo app antigo ou pela API direta. Todas vêm de getPublicUrl do
-- Storage (https://<projeto>.supabase.co/...).
--
-- Antes de aplicar (23/11/2026): 0 linhas violavam a regra em todas as colunas.
-- Vazio ('') continua aceito (não abre nada); NULL também.
-- Fora daqui de propósito: link_rastreio (digitado à mão pelo fornecedor) e
-- cartao_link_pagamento (aceita texto livre com instruções de pagamento).
--
-- NOT VALID + VALIDATE: a inclusão só segura a tabela por um instante; a
-- validação roda com SHARE UPDATE EXCLUSIVE (não bloqueia leitura nem escrita).
--
-- ROLLBACK:
--   alter table public.carteira     drop constraint if exists carteira_comprovante_url_https;
--   alter table public.carteira     drop constraint if exists carteira_boleto_url_https;
--   alter table public.pedidos      drop constraint if exists pedidos_comprovante_pagamento_url_https;
--   alter table public.pedidos      drop constraint if exists pedidos_boleto_url_https;
--   alter table public.pedidos      drop constraint if exists pedidos_nf_url_https;
--   alter table public.faturamentos drop constraint if exists faturamentos_boleto_url_https;
--   alter table public.faturamentos drop constraint if exists faturamentos_nf_url_https;

set local lock_timeout = '3s';

alter table public.carteira
  add constraint carteira_comprovante_url_https
    check (comprovante_url = '' or comprovante_url ~* '^https://') not valid,
  add constraint carteira_boleto_url_https
    check (boleto_url = '' or boleto_url ~* '^https://') not valid;

alter table public.pedidos
  add constraint pedidos_comprovante_pagamento_url_https
    check (comprovante_pagamento_url = '' or comprovante_pagamento_url ~* '^https://') not valid,
  add constraint pedidos_boleto_url_https
    check (boleto_url = '' or boleto_url ~* '^https://') not valid,
  add constraint pedidos_nf_url_https
    check (nf_url = '' or nf_url ~* '^https://') not valid;

alter table public.faturamentos
  add constraint faturamentos_boleto_url_https
    check (boleto_url = '' or boleto_url ~* '^https://') not valid,
  add constraint faturamentos_nf_url_https
    check (nf_url = '' or nf_url ~* '^https://') not valid;

alter table public.carteira     validate constraint carteira_comprovante_url_https;
alter table public.carteira     validate constraint carteira_boleto_url_https;
alter table public.pedidos      validate constraint pedidos_comprovante_pagamento_url_https;
alter table public.pedidos      validate constraint pedidos_boleto_url_https;
alter table public.pedidos      validate constraint pedidos_nf_url_https;
alter table public.faturamentos validate constraint faturamentos_boleto_url_https;
alter table public.faturamentos validate constraint faturamentos_nf_url_https;
