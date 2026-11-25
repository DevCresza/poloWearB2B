# 13. Operação

Publicar o site é fazer merge no main; mudar o banco é aplicar uma migração testada, com rollback escrito, depois das 20h quando trava tabela.

### Como publicar o site

1. Crie um branch a partir do main e abra um PR para o main, com descrição em português.
2. Rode `npm run build` e `npm run lint`: nenhum erro novo.
3. O dono revisa e faz o merge. O merge é a decisão de publicar.
4. A Vercel publica em www.portalpolowear.com.br a cada merge no main.
5. As abas abertas percebem a versão nova e recarregam sozinhas (aviso "versão nova").
6. Confira os logs do Supabase nas primeiras chamadas depois do deploy.

Quando o front e o banco mudam juntos, a ordem importa:

| Caso | Ordem |
|---|---|
| A regra nova do banco quebraria o site antigo | Publique o site primeiro, depois aplique a migração |
| O site novo depende de função ou coluna nova | Aplique a migração primeiro (só acrescentando), depois publique |
| Os dois | Divida em fases: acrescentar, publicar, depois apertar a regra |

### Como criar uma migração

1. Crie o arquivo em `supabase/migrations/AAAAMMDDHHMMSS_nome_curto.sql`.
2. Escreva no topo um comentário: o que muda, por que, e o rollback completo.
3. Use `create or replace` em vez de apagar e recriar, sempre que der.
4. Toda visão nova ou recriada precisa de `with (security_invoker = on)`.
5. Toda função nova precisa de `set search_path` e, se for `security definer`, checar o papel por dentro.
6. Revogue o EXECUTE de `anon` e `public` nas funções novas.

### Como testar antes de aplicar

1. Use um banco local (`supabase start`) ou o banco de produção dentro de uma transação desfeita.
2. Na transação, comece com `set local lock_timeout = '3s'` e `set local statement_timeout = '30s'`.
3. Simule cada papel com `set local role authenticated` e `request.jwt.claims` (admin, fornecedor, multimarca ou franqueado, cadastro e vendedor).
4. Compare antes e depois: linhas visíveis por papel e resultado de INSERT, UPDATE e DELETE numa amostra.
5. Termine com um erro proposital, para a transação ser desfeita.
6. Faça todos os papéis numa chamada só.
7. Nunca grave dado real fora de uma transação desfeita.

### Como aplicar em produção

1. Aplique pelo MCP do Supabase com `apply_migration`, usando o mesmo nome do arquivo.
2. Renomeie o arquivo para a versão que ficou gravada no banco.
3. `create index concurrently` vai por `execute_sql`, fora de transação, um índice por vez.
4. Se a mudança trava tabela (trigger, policy, coluna), aplique depois das 20h de Brasília.
5. Comandos com DROP, DELETE ou TRUNCATE pedem confirmação manual do dono no terminal.
6. Depois de aplicar, confira os advisors e os logs.
7. Se algo quebrar, rode o rollback na hora e avise.

### Correções de dados

1. Só com aprovação do dono, caso a caso.
2. Faça backup das linhas no esquema `backups` antes.
3. Rode tudo numa transação; desligue os gatilhos de usuário só dentro dela, para não disparar e-mails.
4. Guarde o script e o rollback em `supabase/conciliacao/` ou `supabase/scripts/`.

### Monitoramento

| O que olhar | Onde | Para quê |
|---|---|---|
| Advisors de segurança e desempenho | Painel do Supabase ou `get_advisors` | Regras abertas, funções sem search_path, índices |
| Logs da API | `get_logs` (api) | Erros 4xx e 5xx depois de uma mudança |
| Logs das Edge Functions | `get_logs` (edge-function) | Falhas de e-mail e de usuários |
| Logs do Storage | `get_logs` (storage) | Uploads recusados |
| Consultas mais pesadas | `pg_stat_statements` | Lentidão do banco |
| Tarefas agendadas | `cron.job_run_details` | Falhas do cron |
| Fila do pg_net | `net._http_response` | Falhas da chamada aos e-mails |
| E-mails enviados | Tela Histórico de E-mails e `pedido_notifications_sent` | Se o e-mail saiu |
| Violações de CSP | Tabela `csp_reports` | O que a CSP bloquearia |
| Auditoria do pedido | `pedido_historico` e detalhe do pedido | Quem mudou o quê |

### Lembretes agendados

| Data | Lembrete |
|---|---|
| 01/12/2026 | Começar as melhorias restantes, uma tarefa por vez |
| 23/12/2026 | Limpar as fotos originais, substituídas pelas versões otimizadas |

Lembretes de segurança: ver o documento interno do dono.

### Perguntas em aberto

- Reavaliar os índices sem uso a partir de 10/12 (30 dias de estatística) ainda não tem lembrete. Agendar?

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
