# 15. Pendências e próximos passos

As correções urgentes estão no ar; o que falta são melhorias de base, que começam em 01/12, uma tarefa por vez, e algumas decisões do dono.

### Melhorias restantes, com calma (a partir de 01/12)

| Ordem | Tarefa | O que entrega |
|---|---|---|
| 1 | Testes e CI (T23) | Testes de regras de acesso por papel, testes unitários, e build, lint e advisors rodando a cada PR |
| 2 | Migrações em ordem (T17) | Uma base inicial do banco no repositório, versões alinhadas e aplicação só pelo CLI |
| 3 | Cache e login no front (T14) | Menos consultas repetidas ao trocar de tela |
| 4 | Interface (T21) | Proteção contra tela branca, confirmações no padrão do portal, rótulos em botões de ícone, estados vazios e carrinho por usuário |
| 5 | Redução segura de itens pelo cliente (resto do T9) | O cliente diminui quantidades de um pedido novo, com o total recalculado no banco |
| 6 | Atualizações grandes de bibliotecas | vite 8, recharts 3, lucide-react 1, react-dom e @types/node |

Pendências de segurança: ver o documento interno do dono.

### Em aberto com o dono

| Assunto | Situação |
|---|---|
| Pedidos faturados sem nenhuma cobrança | O dono confere com os fornecedores |
| Contagem física de produtos | Aguardando a contagem |

Quantidades e valores: ver o documento interno do dono.

### Lembretes agendados

| Data | Lembrete |
|---|---|
| 01/12/2026 | Começar as melhorias restantes |
| 23/12/2026 | Limpar as fotos originais |

### Outras pendências encontradas nesta documentação

1. A cobrança diária por e-mail (enviarCobrancaVencimento) não está agendada.
2. A home ainda carrega imagens do Storage do projeto antigo do Base44; copiar para o bucket assets.
3. Reavaliar os índices sem uso a partir de 10/12 (30 dias de estatística).
4. Limpeza periódica da tabela de e-mails enviados.
5. Arquivos legados do front (mock*, functions.js e src/services) podem ser removidos.

### Decisões em aberto

- Bloqueio por inadimplência: continua só manual, ou volta o automático por atraso?
- NF de lote: a mesma NF em pedidos diferentes do mesmo fornecedor é regra aceita?
- Produto "essencial": vira obrigação de compra nas cápsulas?
- Backups: por quanto tempo guardar as cópias do esquema backups?
- Saldo pendente: unificar a conta do painel do admin com a do painel inicial?

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
