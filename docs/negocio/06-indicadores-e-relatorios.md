# 6. Indicadores e relatórios

Os números dos painéis são calculados no banco de dados. Cada pessoa só vê os números dos pedidos e títulos a que tem acesso.

Assim, o mesmo painel mostra o total geral para a administração, o da marca para o fornecedor e o da loja para o cliente.

### Cartões do painel inicial (todos os papéis)

| Cartão | O que mostra | De onde vem |
|---|---|---|
| Total de pedidos (ou de compras) | Quantidade de pedidos não cancelados | Pedidos |
| Valor dos pedidos | Soma do valor total dos pedidos não cancelados | Pedidos |
| Faturamento real (ou valor faturado) | Soma do valor faturado dos pedidos faturados, em transporte, aguardando pagamento ou finalizados | Pedidos |
| Saldo pendente | Valor ainda não faturado (ver nota abaixo) | Pedidos |
| Quebra total | Soma do valor de quebra de produção (não aparece para a loja) | Pedidos |
| Valores a vencer | Títulos pendentes com vencimento depois de hoje | Carteira |
| Valores vencidos | Títulos pendentes com vencimento antes de hoje | Carteira |
| Sem vencimento | Títulos pendentes sem data (só aparece se houver) | Carteira |

Nota sobre o saldo pendente:
- no painel do admin, é o valor dos pedidos em produção ou parcialmente faturados menos o que já foi faturado deles;
- no painel inicial, é o valor dos pedidos menos o valor faturado.

O painel também pode ser filtrado por loja, quando a pessoa tem mais de uma.

### Painel da administração

| Bloco | O que mostra |
|---|---|
| Pedidos atrasados | Em produção há mais de 16 dias; faturados com NF há mais de 6 dias sem envio |
| Evolução do faturamento | Últimos 12 meses, pelo mês da nota fiscal |
| Ticket médio e crescimento mensal | Valor médio por pedido e variação contra o mês anterior |
| Pedidos faturados | Quantidade e valor |
| Distribuição por situação | Pedidos em cada situação |
| Evolução diária | Pedidos e valor dos últimos 30 dias (dia de Brasília) |
| Top 10 clientes | Por valor faturado |
| Top 10 produtos | Por peças vendidas |
| Produtos ativos e estoque baixo | Contagem de produtos e dos que estão no estoque mínimo |
| Faturamento por fornecedor | Valor faturado de cada marca |
| Clientes novos | Cadastrados nos últimos 30 dias |

### Metas

1. A administração cadastra metas por mês, de valor e de peças, por fornecedor ou por cliente.
2. O realizado soma os pedidos do mês em produção, faturados, em transporte, aguardando pagamento ou finalizados.
3. Peças de grade contam a grade inteira; peças vendidas por tamanho contam uma a uma.

### Carteira financeira

| Cartão | O que mostra |
|---|---|
| Em aberto | Títulos a pagar |
| Vencido | Pendentes com vencimento antes de hoje |
| Vence em 7 dias | Pendentes que vencem na próxima semana |
| Pago | Títulos pagos |

A lista mostra "parcela X de Y", tem busca e filtros calculados no banco, e pagina 50 títulos por vez. Os cartões somam todos os títulos do filtro, não só a página.

### Outros relatórios

| Relatório | Onde | Para quem |
|---|---|---|
| Lista de pedidos com exportação CSV e PDF | Pedidos (admin) e Pedidos do fornecedor | Admin e fornecedor |
| Extrato de itens e relatório de produção | Pedidos | Admin e fornecedor |
| Histórico de compras | Histórico de Compras | Loja e fornecedor |
| Meus pedidos com exportação | Meus Pedidos | Loja |
| Conferência de cobrança | Carteira (admin) | Admin |
| Histórico de e-mails enviados | Histórico de E-mails | Admin e fornecedor |
| Histórico de cada pedido (quem mudou o quê) | Detalhe do pedido | Quem vê o pedido |

Nas exportações CSV, os valores em dinheiro saem como número, prontos para somar na planilha.

### Regras comuns a todos os números

- Dia e mês são sempre os de Brasília.
- O título que vence hoje ainda não conta como vencido.
- Pedidos cancelados não entram nos totais de venda.

### Perguntas em aberto

- O saldo pendente usa conta diferente no painel do admin e no painel inicial. Vale unificar?

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
