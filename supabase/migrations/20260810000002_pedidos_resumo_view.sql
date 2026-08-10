-- View leve para as LISTAS de pedido: tudo menos o itens (jsonb pesado), mais as
-- colunas pre-calculadas qtd_pecas e meses_entrega. security_invoker garante que
-- o RLS de pedidos continua valendo (vendedor/fornecedor veem so o que podem).
-- Ao adicionar coluna nova em pedidos, incluir aqui se as telas de lista usarem.
create or replace view public.pedidos_resumo
with (security_invoker = on) as
select p.id, p.comprador_user_id, p.fornecedor_id, p.status, p.status_pagamento,
       p.valor_total, p.desconto, p.valor_frete, p.valor_final, p.endereco_entrega,
       p.data_prevista_entrega, p.data_entrega_real, p.transportadora, p.codigo_rastreio,
       p.nota_fiscal, p.observacoes, p.observacoes_internas, p.created_date, p.updated_at,
       p.franqueado_id, p.mes_referencia, p.metodo_pagamento, p.metodo_pagamento_original,
       p.data_pagamento, p.data_aprovacao, p.data_envio_real, p.nf_url, p.nf_numero,
       p.nf_data_upload, p.boleto_url, p.boleto_data_upload, p.cliente_confirmou_boleto,
       p.cliente_confirmou_nf, p.cliente_confirmou_recebimento, p.observacoes_comprador,
       p.observacoes_fornecedor, p.urgente, p.motivo_recusa, p.comprovante_pagamento_url,
       p.comprovante_pagamento_data, p.qtd_parcelas, p.parcelas_info, p.link_rastreio,
       p.valor_frete_fob, p.data_confirmacao_nf, p.data_confirmacao_boleto,
       p.data_confirmacao_recebimento, p.loja_id, p.tipo_frete, p.frete_incluso_boleto,
       p.frete_modo_cobranca, p.impresso, p.data_impressao, p.valor_faturado, p.valor_quebra,
       p.observacao_recebimento, p.estoque_baixado, p.pix_info, p.itens_revisados_em,
       p.cartao_link_pagamento, p.emitido_por_admin_user_id, p.criado_por_user_id,
       p.criado_por_papel, p.qtd_pecas, p.meses_entrega
from public.pedidos p;

grant select on public.pedidos_resumo to authenticated, anon;
