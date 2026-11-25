# 4. Regras de negócio

As regras de preço, mínimo, pagamento, bloqueio e estoque são conferidas pelo banco de dados no momento do pedido, e não só na tela.

### 4.1 Preço por tipo de cliente

1. Cada produto tem um preço para franqueado e outro para multimarca.
2. O preço usado é sempre o do comprador, mesmo quando um vendedor compra por ele.
3. Produto sem preço para o perfil do comprador é recusado no pedido.
4. Produto vendido em grade tem preço por grade; vendido por tamanho, preço por peça.

### 4.2 Pedido mínimo por tipo de cliente

O mínimo é de cada fornecedor e depende do tipo do comprador. Ele vale para a soma do pedido daquele fornecedor.

| Regra | Como funciona |
|---|---|
| Cliente multimarca | Usa o "mínimo multimarca" do fornecedor |
| Cliente franqueado | Usa o "mínimo franqueado" do fornecedor |
| Sem mínimo específico | Usa o mínimo geral antigo do fornecedor |
| Pedido em lote da administração | Não tem mínimo |

Valores cadastrados por fornecedor: ver o documento interno do dono.

### 4.3 Cápsulas

Cápsula é um kit de coleção: um conjunto de produtos de um fornecedor com quantidades mínimas.

1. O kit define a quantidade mínima de cada produto, cor ou tamanho.
2. A loja pode aumentar as quantidades, mas nunca ficar abaixo do mínimo.
3. A loja não muda a forma do kit (as cores e tamanhos são os definidos no cadastro).
4. Cada cápsula diz se aparece para franqueado, para multimarca ou para os dois.
5. Produto arquivado sai do kit; o resto continua valendo.
6. Cápsula com pedido não pode ser excluída, só arquivada.
7. As cápsulas aparecem no catálogo em linhas por grupo (por exemplo, "Inverno") e por ano.
8. Produto marcado como "essencial" mostra um selo, mas não obriga a compra.

### 4.4 Meses de entrega

Cada item do pedido cai num mês de entrega, escolhido nesta ordem:

1. O mês escolhido na cápsula, se houver.
2. A data prevista de entrega do produto.
3. A data prevista de entrega do pedido, informada pelo fornecedor.
4. O mês em que o pedido foi feito (horário de Brasília).

Regras complementares:

- Se a cápsula tem mais de um mês disponível, a loja escolhe um ao fechar o pedido; se tem um só, ele vale direto.
- O mês é recalculado quando mudam os itens, a data prevista do pedido ou a data prevista do produto.
- Item de produto que foi apagado mantém o mês que já tinha.

### 4.5 Meses de faturamento

1. O mês de faturamento é o mês de emissão de cada nota fiscal do pedido.
2. Um pedido faturado em partes pode ter mais de um mês de faturamento.
3. Pedidos antigos sem nota registrada usam a data em que a NF foi anexada.

### 4.6 Formas de pagamento

| Tipo de cliente | Formas possíveis |
|---|---|
| Multimarca | PIX, cartão de crédito, transferência |
| Franqueado | PIX, cartão de crédito, boleto faturado, transferência |
| Franqueado na lista "sem boleto" do fornecedor | PIX, cartão de crédito |

A forma escolhida também precisa estar entre as aceitas pelo fornecedor. As formas aceitas por fornecedor: ver o documento interno do dono.

### 4.7 Boleto e parcelas

1. Ao fechar o pedido nasce um título provisório, com o valor total e vencimento em 30 dias.
2. No faturamento, o fornecedor gera as parcelas do boleto pela nota fiscal.
3. As parcelas da nota substituem o título provisório e qualquer boleto antecipado pendente.
4. Títulos pagos ou com comprovante em análise nunca são apagados nem cobrados de novo.
5. A soma das parcelas não pode passar do valor da nota (tolerância de R$ 0,05).
6. Depois que o pedido tem nota, o boleto "pelo pedido" é recusado: vale o boleto da nota.
7. Uma nota pode ser paga em várias formas, por exemplo metade à vista e metade no cartão.
8. As datas de vencimento precisam ser crescentes e ter ano entre 2020 e 2100.

Os prazos do boleto faturado são cadastrados por fornecedor e sugerem os vencimentos. Prazos por fornecedor: ver o documento interno do dono.

### 4.8 Bloqueio por inadimplência

O bloqueio hoje é manual: só a administração bloqueia e desbloqueia.

1. Pode-se bloquear o cliente inteiro ou uma loja dele.
2. Cliente ou loja bloqueados não conseguem fazer pedido novo.
3. O cliente não consegue se desbloquear sozinho.
4. O portal mostra o total em aberto e o total vencido de cada cliente, para apoiar a decisão.
5. Vencido é o título pendente com vencimento antes de hoje (horário de Brasília). O título que vence hoje ainda não é vencido.
6. Os totais são recalculados a cada mudança na carteira e todo dia às 03h10.

### 4.9 Estoque

| Disponibilidade | Controle de estoque |
|---|---|
| Pronta entrega com controle ligado | Sim: o pedido baixa o estoque na hora |
| Sob encomenda e pré-venda | Não: produção sob pedido |

1. Sem saldo, o pedido é recusado, a menos que o produto permita venda sem estoque.
2. O estoque pode ser controlado por cor ou por tamanho.
3. Ao cancelar o pedido, o estoque volta sozinho, uma única vez.
4. Ao revisar os itens, só a diferença entra ou sai.
5. Cada entrada e saída fica registrada, com o pedido e o motivo.
6. Pedidos em lote da administração não baixam estoque.
7. O fornecedor e a administração fazem ajustes manuais na tela de estoque.

### 4.10 Replicar pedido para várias lojas

1. A loja com mais de uma unidade pode enviar o mesmo carrinho para várias lojas de uma vez.
2. Sai um pedido por loja, cada um com a sua validação de mínimo, bloqueio e estoque.
3. Se uma loja falha, as que deram certo não são repetidas numa nova tentativa.
4. O clique duplo não gera pedido em dobro.

### 4.11 Pedido em lote da administração

1. A administração escolhe uma cápsula, a quantidade, o mês de entrega e as lojas.
2. Sai um pedido por loja, com o preço do tipo de cliente dono da loja.
3. Não há pedido mínimo nem baixa de estoque.
4. Só a administração cancela esses pedidos.

### Perguntas em aberto

- Vale voltar a ter bloqueio automático por atraso, ou o bloqueio continua só manual?
- O selo "essencial" deve virar obrigação de compra nas cápsulas?
- A mesma NF em pedidos diferentes do mesmo fornecedor (NF de lote) é aceita como regra?

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
