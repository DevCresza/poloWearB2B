# 2. Papéis e permissões

Cada usuário tem um único papel, e é o papel que decide o que ele vê e faz no portal e no banco de dados.

As permissões não são escolhidas pessoa a pessoa. Elas vêm do papel, e o banco confere tudo de novo, mesmo que alguém tente burlar a tela.

### Os seis papéis

| Papel | Quem é | Resumo |
|---|---|---|
| Admin | Equipe Polo Wear | Vê e faz tudo |
| Fornecedor | Usuário de uma marca | Cuida dos pedidos, produtos e cobrança da própria marca |
| Multimarca | Loja multimarca | Compra o que está liberado para multimarca |
| Franqueado | Loja franqueada | Compra o que está liberado para franqueado |
| Cadastro | Equipe de cadastro | Cadastra produtos e cápsulas, com preço |
| Vendedor | Representante comercial | Compra em nome de um cliente e vê todos os pedidos, sem os valores de faturamento |

### O que cada papel vê e faz

Legenda: "Sim" = pode; "Próprios" = só os da sua marca ou loja; "Não" = não pode.

| Ação | Admin | Fornecedor | Multimarca | Franqueado | Cadastro | Vendedor |
|---|---|---|---|---|---|---|
| Ver o painel inicial | Sim | Próprios | Próprios | Próprios | Sim | Sim |
| Ver o catálogo e as cápsulas | Sim | Não | Sim | Sim | Sim | Sim |
| Montar carrinho e fechar pedido | Em nome do cliente | Não | Sim | Sim | Não | Em nome do cliente |
| Ver os próprios pedidos | Sim | Sim | Sim | Sim | Não | Sim |
| Ver os pedidos de todos | Sim | Não | Não | Não | Não | Sim |
| Aceitar, faturar e enviar pedido | Sim | Próprios | Não | Não | Não | Não |
| Cancelar pedido | Sim | Próprios | Só "novo pedido" | Só "novo pedido" | Não | Só "novo pedido" |
| Cancelar pedido emitido em lote | Sim | Não | Não | Não | Não | Não |
| Emitir pedidos em lote | Sim | Não | Não | Não | Não | Não |
| Enviar boleto, NF e PIX | Sim | Próprios | Não | Não | Não | Não |
| Informar pagamento e enviar comprovante | Sim | Não | Próprios | Próprios | Não | Não |
| Aprovar ou recusar comprovante | Sim | Próprios | Não | Não | Não | Não |
| Ver a carteira (títulos) | Sim | Próprios | Próprios | Próprios | Não | Não |
| Ver totais de faturamento | Sim | Próprios | Não | Não | Não | Não |
| Cadastrar e editar produtos e cápsulas | Sim | Próprios | Não | Não | Sim | Não |
| Controlar estoque | Sim | Próprios | Não | Não | Não | Não |
| Exportar relatórios | Sim | Próprios | Não | Não | Não | Não |
| Bloquear e desbloquear cliente ou loja | Sim | Não | Não | Não | Não | Não |
| Gerir usuários, clientes e fornecedores | Sim | Não | Não | Não | Não | Não |
| CRM, metas e configurações | Sim | Não | Não | Não | Não | Não |
| Materiais (Recursos) | Sim | Sim | Sim | Sim | Sim | Sim |

### Regras que valem para todos

- Ninguém muda o próprio papel, o próprio limite de crédito nem o fornecedor ao qual está ligado.
- O cliente não se desbloqueia e não muda vencimento, valor ou parcela de um título.
- O cliente não altera itens nem valores de um pedido depois de enviado. Para mudar, fala com o fornecedor ou com a equipe.
- O fornecedor só enxerga os pedidos, títulos e movimentações de estoque da própria marca.
- Quem compra em nome de outro usa sempre os dados do comprador: preço, mínimo, bloqueio, endereço e formas de pagamento.

### Mudanças de situação permitidas para cliente e vendedor

| De | Para | Quando |
|---|---|---|
| Novo pedido | Cancelado | O fornecedor ainda não aceitou (e o pedido não é de lote) |
| Em transporte | Aguardando pagamento | O cliente confirma o recebimento |
| Em transporte | Finalizado | O cliente confirma o recebimento e tudo está pago |

Na cobrança, o cliente só muda o título de "pendente" para "em análise", ao enviar o comprovante.

### Pendências

Pendências de segurança: ver o documento interno do dono.

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
