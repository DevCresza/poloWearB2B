-- Correcao de dados + trava contra a duplicacao de parcelas.
--
-- Origem do problema: as telas de "enviar boleto por NF"
-- (PedidoDetailsModal.handleUploadBoletoFat e
-- PedidosFornecedor.handleEnviarBoletoNF) CRIAVAM as parcelas sem apagar as do
-- envio anterior. Reenviar o boleto da mesma NF -- o que o fornecedor faz
-- justamente quando erra uma data -- gerava um jogo inteiro de titulos novo.
-- O cliente passava a dever 2x ou 3x, `users.total_vencido` (derivado da
-- carteira) subia junto e o fornecedor via "Cliente Inadimplente" na hora de
-- faturar, sem o cliente dever nada disso.
--
-- Piorava porque handleEditBoleto renumera `parcela_numero` pela posicao na
-- lista: com titulos repetidos, varias linhas acabaram com o mesmo numero.
--
-- O codigo ja apaga as parcelas nao-pagas antes de recriar. Aqui: limpa o
-- passado e fecha a porta no banco.
--
-- Nenhum dos titulos removidos estava pago nem tinha comprovante anexado.

begin;

-- 1) Duplicados. Mantem, em cada pedido, o ultimo envio de boleto.
--    #1685F898 (NF 5675): fica 23/08, 22/09, 22/10, 21/11
--    #CB2BB579 (NF 1070): fica 01/08, 31/08, 30/09
--    #2EA0BD38 (NF 000004675): fica 10/08, 08/09, 08/10, 09/11
delete from public.carteira
where id in (
  -- #1685F898
  '8bf41e22-0e00-449c-bb93-5b8c024d9373',
  'ebb11b65-bd24-4d7c-be03-cd8938cad5c7',
  '71312345-f853-4115-8d1f-06f05a5d32d0',
  '062ff9f2-8fef-451a-9c4b-d3ec98133123',
  'a3917bd1-ff57-48be-bf9f-46ebf4fecbcc',
  'cdbfec45-f9ad-4c9a-9304-d9d66e726dc7',
  'dfb3b493-5c78-4191-9cdc-ae814b9ddcfd',
  '2d33c2f6-4458-4ce9-8747-5992d5a8dd19',
  -- #CB2BB579
  'b35d6c20-598e-487e-9208-d9c6f5ce02c9',
  '05d34a70-1c96-4078-ac0e-3ba6bd03757b',
  '62784b7b-5ca5-41b7-9d8a-e48c6e4167a9',
  '0721384f-8015-49b9-a642-6123ffc403aa',
  'dc7e9a12-26a1-44cb-b59f-5de9079d435d',
  'acc5a226-ba2e-45e0-81bd-9645d6c55e78',
  -- #2EA0BD38
  '150c180b-357e-441a-827c-257a175d723a',
  '01083896-ae1b-491d-8d93-bcff4c4d8991',
  '4ffc88c8-eebc-4121-bc75-bc8115ebb25e',
  'd643584f-f862-4b1c-82a7-7b66b709e578'
);

-- 2) Datas com o ano digitado errado. A parcela nascia vencida e marcava o
--    cliente como inadimplente. O valor correto vem da propria sequencia
--    (as parcelas anteriores sao mensais).
update public.carteira set data_vencimento = date '2027-01-02'
 where id = '4f353083-ec2e-49b5-a8ae-70fc1c02e4fc';  -- #E2A81460 p4: era 0206-12-03
update public.carteira set data_vencimento = date '2026-12-03'
 where id = '0be94ccf-7d93-4b64-b9e5-20148db1cb41';  -- #E2A81460 p3: era 2026-11-03 (igual a p2)
update public.carteira set data_vencimento = date '2027-01-02'
 where id = 'ce0d28c0-b7fb-4f86-a7fa-e947c49728dd';  -- #B58892A1 p4: era 2026-01-02
update public.carteira set data_vencimento = date '2027-01-02'
 where id = '7fa69906-c54c-4de7-bdef-a5925252ccc1';  -- #910A4EEB p5: era 2026-01-02
update public.carteira set data_vencimento = date '2027-01-02'
 where id = '6143db72-6914-4c1b-9668-ceeaba3be31d';  -- #59895BF1 p5: era 2026-01-02

-- 3) A partir daqui o banco recusa a segunda copia de uma parcela da mesma NF,
--    independente de qual tela criou.
create unique index if not exists carteira_parcela_unica_por_faturamento
  on public.carteira (faturamento_id, parcela_numero)
  where faturamento_id is not null and parcela_numero is not null;

-- 4) Sem linhas com ano impossivel, a checagem de vencimento passa a valer
--    tambem para o historico.
alter table public.carteira validate constraint carteira_data_vencimento_plausivel;

-- 5) O trigger ja recalcula por linha, mas garante o estado final.
select public.recalcular_total_vencido();

commit;
