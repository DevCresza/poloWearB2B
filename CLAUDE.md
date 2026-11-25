# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Portal B2B multimarcas da Polo Wear: catálogo, cápsulas, pedidos, faturamento, carteira,
estoque, CRM e metas. Vite + React no front, **Supabase** no back (Postgres com RLS,
funções, Edge Functions, Storage, pg_cron, pg_net) e Resend para e-mail.

- **Produção:** `www.portalpolowear.com.br` (Vercel, publica a cada merge no `main`;
  `polo-wear-b2-b.vercel.app` é o mesmo deploy). O app antigo `polo-wear.vercel.app`
  redireciona para o portal.
- **Banco:** um só, o projeto Supabase **Polowear2** (`jbdcoftzffrppkyzdaqr`, sa-east-1), com
  dados reais. Não existe banco de homologação.
- **Documentação completa:** [`docs/README.md`](docs/README.md) — negócio (papéis, jornada do
  pedido, regras, faturamento, indicadores, glossário) e técnica (arquitetura, modelo de
  dados, segurança, funções, front, operação, histórico e pendências). Leia a seção do
  assunto antes de mexer; ao mudar regra, tabela, função ou rota, atualize a seção no mesmo PR.

## Autorização (leia antes de mexer em acesso)

Detalhes em [`docs/negocio/02-papeis-e-permissoes.md`](docs/negocio/02-papeis-e-permissoes.md)
e [`docs/tecnico/10-seguranca.md`](docs/tecnico/10-seguranca.md).

**Fonte única de verdade — não reimplemente checagem de papel na página:**

- `src/utils/roles.js` — papéis: `admin`, `vendedor`, `cadastro`, `fornecedor`, `multimarca`, `franqueado`.
  `role` é a fonte de verdade; `tipo_negocio` é redundante e mantido em sincronia.
- `src/utils/permissoes.js` — `can(user, PERM.X)` e `PERMISSAO_POR_PAGINA`. A permissão é
  **derivada do papel**. A coluna `users.permissoes` (jsonb) é legado e **não autoriza nada**.
- `src/components/ProtectedRoute.jsx` — guarda de rota única, aplicada em `src/pages/index.jsx`.
  Página nova: adicione a permissão em `PERMISSAO_POR_PAGINA` e envolva a rota.

**Papéis internos:**
- **Vendedor** — catálogo/cápsulas como as lojas veem; fecha pedido *em nome de um cliente*
  (`src/contexts/RepresentacaoContext.jsx`); vê todos os pedidos, mas **não** os totais de
  faturamento nem custo.
- **Cadastro** — cria/edita/ativa produtos e cápsulas (com preço). Sem pedidos, sem financeiro.

**Comprando em nome de outro (vendedor):** preço, pedido mínimo, direito a boleto,
inadimplência, bloqueio, endereço e `comprador_user_id` são todos do **comprador**, nunca de
quem opera a tela. No `Carrinho.jsx`, `user` é o *sujeito da compra* e `usuarioLogado` é quem
está logado — não troque os dois.

**Segurança real está no banco (RLS), não na UI:**
- `public.app_role()` / `is_admin()` / `is_staff()` / `ve_todos_pedidos()` /
  `meu_fornecedor_id()` / `pode_gerir_catalogo()` alimentam as policies, sempre na forma
  `(select f())` (avaliada uma vez por consulta).
- Triggers guardam **colunas** (RLS guarda linhas): usuário não muda o próprio papel nem se
  desbloqueia, cliente não altera valor/itens do pedido nem se dá por pago na carteira.
- **Dinheiro e estoque só por RPC**, que valida o papel por dentro:
  `criar_pedido` (checkout, preço recalculado no banco, idempotente),
  `emitir_pedido_lote` (admin), `registrar_faturamento` e `substituir_parcelas`
  (admin ou fornecedor do pedido). O cliente **não** tem INSERT direto em `pedidos` nem em
  `carteira`; o estoque é baixado/estornado pelo banco (trigger `trg_pedidos_zz_estoque`).
- Documentos (NF, XML, boleto, comprovante) ficam no bucket **privado** `documentos`, em
  `fornecedor/<fornecedor_id>/` ou `cliente/<user_id>/`, e abrem por URL assinada
  (`src/utils/documentos.js`, `abrirUrlSegura`).
- Edge Functions de usuário (`create-user`, `update-user-*`, `resetUserPassword`,
  `deleteAuthUser`) exigem chamador **admin**. Ao criar uma nova, replique essa checagem.
- Toda view nova ou recriada leva `with (security_invoker = on)`; toda função nova leva
  `set search_path` e não dá EXECUTE a `anon`/`public`.

## Development Commands

```bash
npm install       # dependências
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção (sem erros novos antes do PR)
npm run lint      # lint (sem erros novos antes do PR)
npm run preview   # serve o build
```

Não há testes automatizados nem CI ainda (ver `docs/tecnico/15-pendencias.md`).

## Estrutura

- `src/pages/` — uma tela por arquivo; `index.jsx` tem as rotas (carregadas com
  `lazyComRecarga`); `Layout.jsx` tem o menu por papel.
- `src/api/` — `entities.js` reexporta `createSupabaseEntity('tabela')`
  (`supabaseEntities.js`) e `User` (`supabaseAuth.js`); `pedidos.js`, `faturamento.js`,
  `parcelas.js` e `kpis.js` chamam as RPCs. `functions.js` e `mock*` são legado do Base44 e
  não devem ser usados.
- `src/utils/` — regras compartilhadas com o banco: `itemPedido.js`, `precoCliente.js`,
  `capsulaItens.js`, `pedidoMinimo.js`, `dataBR.js` (sempre horário de Brasília),
  `divisaoPagamento.js`, `vencimentoUtils.js`, `exportUtils.js`, `urlSegura.js`, `thumb.js`.
- `src/contexts/` — `AuthContext`, `LojaContext` (carrinho global, loja escolhida no
  checkout), `RepresentacaoContext`.
- `src/components/ui/` — shadcn/ui (new-york, neutral, lucide-react, sem TypeScript).
- `supabase/migrations/` — migrações com rollback no cabeçalho; `supabase/functions/` — Edge
  Functions; `supabase/conciliacao/` e `supabase/scripts/` — correções de dados com rollback.

Detalhes em [`docs/tecnico/12-front-end.md`](docs/tecnico/12-front-end.md).

## Padrões

- **Entidades:** `Produto.list({ filters, sort, limit, columns })`, `filter`, `get`, `create`,
  `update`, `delete`. Peça só as colunas necessárias (`columns`); para listas de pedidos use
  `PedidoResumo` (view `pedidos_resumo`, sem `itens`). Nunca baixe a tabela de pedidos inteira:
  agregações vão para RPC (`kpis_dashboard`, `metas_realizado`, `carteira_resumo`).
- **Erros:** a camada de entidades lança `EntidadeError` com o `code` do banco; `update`/`delete`
  que não atingem nenhuma linha lançam `SEM_LINHAS`.
- **Datas de negócio:** `dataBR.js` (front) e `data_br()` / `hoje_br()` (banco). Timestamps de
  `pedidos` são `timestamp` sem fuso, gravados em UTC.
- **Upload:** `UploadFile` com a pasta do dono; limite de 20 MB; pdf, xml e imagem.
- **Página nova:** componente em `src/pages/`, rota em `index.jsx` com `ProtectedRoute`,
  permissão em `PERMISSAO_POR_PAGINA`, link no `Layout.jsx`.
- Path alias `@/` → `src/`. Arquivos `.js`/`.jsx` (sem TypeScript).

## Banco: como mudar

Resumo; o passo a passo está em [`docs/tecnico/13-operacao.md`](docs/tecnico/13-operacao.md).

1. Arquivo em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql` com o rollback em comentário.
2. Teste em transação desfeita (`set local lock_timeout = '3s'`, `statement_timeout = '30s'`),
   simulando cada papel com `set local role authenticated` + `request.jwt.claims`.
3. Aplique com `apply_migration` (mesmo nome do arquivo) e renomeie o arquivo para a versão
   gravada. `create index concurrently` vai por `execute_sql`, fora de transação.
4. Mudança que trava tabela: depois das 20h (Brasília). Depois: advisors e logs.
5. Dados de negócio (pedidos, títulos, faturamentos, estoque) só mudam com aprovação do dono.
