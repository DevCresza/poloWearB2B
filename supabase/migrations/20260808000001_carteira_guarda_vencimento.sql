-- A data de vencimento das parcelas e digitada a mao pelo fornecedor num
-- <input type="date">. Um deslize passa batido e o titulo nasce vencido:
-- ja apareceu "0206-12-03" (ano 206) na base, e o cliente ficou marcado como
-- inadimplente para sempre, porque total_vencido e derivado da carteira.
--
-- A UI passou a validar (ano fora da faixa, parcelas fora de ordem), mas a
-- garantia tem que estar no banco -- e o que vale para qualquer caminho de
-- escrita.
--
-- NOT VALID: fecha a porta para linhas NOVAS sem tropecar nas linhas
-- historicas ja erradas, que serao corrigidas em uma migration de dados.

alter table public.carteira
  add constraint carteira_data_vencimento_plausivel
  check (
    data_vencimento is null
    or data_vencimento between date '2020-01-01' and date '2100-12-31'
  ) not valid;
