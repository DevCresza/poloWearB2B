# Documentação do Portal Polo Wear B2B

Documentação técnica e de negócios do portal B2B multimarcas da Polo Wear (www.portalpolowear.com.br).

Tudo o que está aqui foi tirado do código do `main`, do banco de produção (Polowear2, só leitura e só contagens) e dos PRs do GitHub. O que não deu para confirmar aparece como pergunta aberta no fim de cada seção.

Situação de referência: 24/11/2026, 20h42 (horário de Brasília).

## Parte 1: negócio

Linguagem para o dono, para as lojas e para os fornecedores.

| # | Seção | Conteúdo |
|---|---|---|
| 1 | [Visão geral do negócio](negocio/01-visao-geral.md) | O que o portal faz, para quem, e os números de hoje |
| 2 | [Papéis e permissões](negocio/02-papeis-e-permissoes.md) | O que cada perfil vê e faz |
| 3 | [Jornada do pedido](negocio/03-jornada-do-pedido.md) | Do catálogo ao pagamento, com diagrama |
| 4 | [Regras de negócio](negocio/04-regras-de-negocio.md) | Mínimo, cápsulas, meses, boleto, bloqueio, estoque e replicação |
| 5 | [Faturamento, cobrança e carteira](negocio/05-faturamento-cobranca-carteira.md) | NF, títulos, pagamentos e comprovantes |
| 6 | [Indicadores e relatórios](negocio/06-indicadores-e-relatorios.md) | O que cada painel mostra e de onde vem |
| 7 | [Glossário](negocio/07-glossario.md) | Os termos do negócio |

## Parte 2: técnica

Para quem desenvolve e opera o portal.

| # | Seção | Conteúdo |
|---|---|---|
| 8 | [Arquitetura](tecnico/08-arquitetura.md) | Front, Supabase, Edge Functions, Storage, cron, Resend e Vercel, com diagrama |
| 9 | [Modelo de dados](tecnico/09-modelo-de-dados.md) | Tabelas, relações e campos-chave, com diagrama |
| 10 | [Segurança](tecnico/10-seguranca.md) | RLS por papel, travas, documentos privados, Edge Functions e CSP |
| 11 | [Funções e automações do banco](tecnico/11-funcoes-e-automacoes.md) | RPCs, gatilhos, cron e e-mails |
| 12 | [Front-end](tecnico/12-front-end.md) | Organização do código, rotas por papel e utilitários |
| 13 | [Operação](tecnico/13-operacao.md) | Publicar, migrar, testar por papel, monitorar e lembretes |
| 14 | [Histórico de novembro de 2026](tecnico/14-historico-novembro-2026.md) | Mudanças com data e PR |
| 15 | [Pendências e próximos passos](tecnico/15-pendencias.md) | Melhorias restantes e decisões em aberto |

## Outros documentos

- [Modelos de e-mail do Supabase Auth](email-templates/INSTRUCOES.md) (confirmação de cadastro e troca de senha).
- Correções de dados aplicadas, com rollback: `supabase/conciliacao/` e `supabase/scripts/`.
- Migrações do banco, com rollback no cabeçalho: `supabase/migrations/`.

## Como manter esta pasta

1. Mudou uma regra de negócio, uma tabela, uma função ou uma rota? Atualize a seção correspondente no mesmo PR.
2. Números (contagens) trazem a data da contagem; não precisam ser atualizados a cada PR.
3. Nada de dados pessoais nem segredos: só papéis, contagens e exemplos genéricos.
4. Os diagramas são mermaid e aparecem renderizados no GitHub.
