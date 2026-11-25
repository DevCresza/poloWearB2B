# 5. Faturamento, cobrança e carteira

Cada nota fiscal vira um registro de faturamento, e cada valor a receber vira um título na carteira, ligado ao pedido e à nota.

### As peças e como se ligam

| Peça | O que é | Ligada a |
|---|---|---|
| Pedido | O que a loja comprou, com itens, valores e situação | Loja, fornecedor e comprador |
| Faturamento | Uma nota fiscal emitida para o pedido, com os itens que ela cobre | Pedido |
| Título | Um valor a receber, com vencimento e situação | Pedido, nota (quando houver), loja e fornecedor |
| Comprovante | O arquivo que a loja envia ao pagar um título | Título |
| Histórico do pedido | Quem mudou o quê e quando | Pedido |

### Tipos de título

| Tipo | Quando nasce | Observação |
|---|---|---|
| Provisório | No fechamento do pedido | Valor total do pedido, vencimento em 30 dias, sem número de parcela |
| Parcela de boleto | No envio do boleto pela nota | Numerada (1, 2, 3...), ligada à nota |
| Parte à vista, cartão, PIX ou transferência | No faturamento, quando a nota é dividida entre formas | Sem vencimento; numerada a partir de 900 |

### Situações do título

| Situação | Significado |
|---|---|
| Pendente | A pagar |
| Em análise | A loja enviou comprovante; aguarda aprovação |
| Pago | Pagamento aprovado |
| Cancelado | Pedido cancelado ou título substituído |

O título provisório também fica "pendente". O total em aberto e o vencido do cliente só contam as parcelas reais (as que já têm boleto). Quantidades por situação: ver o documento interno do dono.

### Passo a passo do faturamento

1. O fornecedor abre o pedido e escolhe "faturar".
2. Informa o número, a data e o arquivo da NF (PDF e XML).
3. Marca os itens e quantidades que a nota cobre; o sistema confere o saldo de cada item.
4. Informa como a nota será paga: uma forma só ou várias.
5. O sistema grava a nota, os títulos das partes que não são boleto e soma o valor faturado no pedido, tudo de uma vez.
6. A mesma NF com o mesmo valor no mesmo pedido é recusada (protege contra clique duplo).
7. O pedido passa a "faturado" ou "parcialmente faturado".

### Passo a passo da cobrança

1. Para boleto, o fornecedor envia as parcelas da nota com datas e arquivos.
2. As parcelas novas substituem o provisório e os boletos pendentes antigos.
3. Para PIX, o fornecedor cadastra os dados de pagamento no pedido.
4. A loja recebe e-mail com o boleto, a NF ou o PIX.

### Passo a passo do pagamento

1. Na carteira, a loja informa o pagamento de um título e envia o comprovante.
2. O título passa para "em análise" e o fornecedor recebe e-mail.
3. O fornecedor (ou a administração) aprova: o título fica "pago".
4. Ou recusa com motivo: o título volta a "pendente" e a loja recebe e-mail.
5. Se a equipe marca o pedido inteiro como pago, todos os títulos pendentes dele ficam pagos.
6. Se o pedido é cancelado, os títulos em aberto são cancelados; os pagos ficam como estão.

### Documentos protegidos

1. NF, XML, boleto e comprovante ficam numa área privada.
2. Cada arquivo é aberto por um link temporário de 1 hora.
3. Só abrem a equipe, o dono do arquivo e a outra parte do pedido.
4. O fornecedor grava na pasta da marca; a loja, na pasta do cliente.
5. Os links enviados por e-mail valem por 60 dias.
6. O tamanho máximo é 20 MB, só PDF, XML e imagem.

### Conferência de cobrança

A administração tem uma conferência que compara, nota a nota, o valor faturado com a soma dos títulos.

Ela aponta três tipos de divergência: diferença de arredondamento, títulos fora da nota e faturado acima do pedido. Números atuais: ver o documento interno do dono.

### Correções de dados já feitas (com aprovação do dono)

| Data | Correção |
|---|---|
| 24/11/2026 | Pedidos faturados sem registro de nota ganharam o registro retroativo, com a NF do pedido |
| 24/11/2026 | Pedidos faturados sem NF ganharam só o valor faturado e uma anotação no histórico |
| 24/11/2026 | Casos especiais registrados (uma data de NF corrigida e uma NF de lote em dois pedidos) |
| 24/11/2026 | Pedidos com mês de entrega defasado foram recalculados |

Quantidades e valores: ver o documento interno do dono. Scripts e rollback em `supabase/conciliacao/`.

### Perguntas em aberto

Ver o documento interno do dono.

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
