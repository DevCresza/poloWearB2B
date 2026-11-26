# 10. Segurança

A segurança real está no banco de dados: a tela só esconde botões, e o banco recusa o que o papel não pode fazer.

São cinco camadas: regras por linha, travas por coluna, funções que validam tudo, arquivos privados e funções do servidor protegidas.

### 1. Quem é quem no banco

| Função do banco | Devolve |
|---|---|
| app_role() | O papel do usuário logado |
| is_admin() | Se é admin |
| is_staff() | Se é da equipe interna |
| ve_todos_pedidos() | Se vê todos os pedidos (admin e vendedor) |
| meu_fornecedor_id() | A marca do usuário fornecedor |
| pode_gerir_catalogo() | Se cadastra produtos (admin, cadastro e fornecedor) |
| chamada_de_servidor() | Se a chamada vem do servidor (Edge Function, cron ou migração) |

As regras chamam essas funções uma vez por consulta, não uma vez por linha.

### 2. Regras por linha (RLS)

| Tabela | Ler | Gravar |
|---|---|---|
| pedidos | Comprador, fornecedor do pedido, admin e vendedor | Criar só pelas funções; alterar com as travas abaixo; apagar só admin |
| carteira | Cliente do título, fornecedor do título e admin | Criar: admin e fornecedor (no próprio); apagar só admin |
| faturamentos | Quem vê o pedido | Admin e fornecedor do pedido |
| produtos e capsulas | Usuários logados | Admin, cadastro e fornecedor (só os da marca) |
| users | O próprio, a equipe e o fornecedor dos seus compradores | O próprio (com travas) e admin |
| lojas | O dono, admin, vendedor e o fornecedor dos seus pedidos | O dono (com travas) e admin |
| movimentacoes_estoque | Admin, cadastro e fornecedor (só os da marca) | Os mesmos |
| pedido_historico | Quem vê o pedido | Ninguém: só o gatilho grava |
| contacts (CRM) | Admin | Admin |
| backups e interno | Ninguém pela API | Ninguém pela API |

O visitante sem login não lê nem grava nenhuma tabela de negócio.

### 3. Travas por coluna (gatilhos de guarda)

| Trava | O que impede |
|---|---|
| Guarda de criação de pedido | Pedido já pago ou faturado, valor zero, comprador ou loja bloqueados, loja de outro dono |
| Guarda de alteração de pedido | Cliente e vendedor mudarem itens, valores, frete, NF ou pagamento; mudanças de situação fora da tabela da seção 2 |
| Pedido em lote | Cancelamento por quem não é admin |
| Guarda de usuário | Mudar o próprio papel, limite, fornecedor, bloqueio ou totais |
| Guarda de loja | O dono desbloquear a loja ou passá-la a outro dono |
| Guarda de carteira | O cliente mudar vencimento, valor, parcela, boleto ou vínculos; ele só envia comprovante |
| Exclusão de produto e cápsula | Apagar item que aparece em algum pedido |
| URLs de arquivo | Gravar link que não seja https |

### 4. Funções que validam tudo

As operações de dinheiro e estoque passam por funções do banco, que validam o papel por dentro:

| Função | Quem pode |
|---|---|
| criar_pedido | Cliente, ou vendedor e admin em nome de um cliente |
| emitir_pedido_lote | Admin |
| registrar_faturamento | Admin ou fornecedor do pedido |
| substituir_parcelas | Admin ou fornecedor do pedido |

O preço vem sempre do banco, nunca do navegador. Um clique duplo devolve o mesmo pedido.

### 5. Documentos privados

1. O bucket de documentos (NF, XML, boleto e comprovante) é privado desde 24/11/2026.
2. Cada arquivo é aberto por URL assinada de 1 hora.
3. Lê o arquivo a equipe, o dono da pasta e a outra parte do pedido.
4. O fornecedor grava em fornecedor/(id da marca)/; o cliente, em cliente/(id do usuário)/. A pasta antiga uploads/ só é lida: desde 26/11/2026 só a equipe grava nela.
5. Limite de 20 MB; só PDF, XML e imagem.
6. Fotos de produto ficam num bucket público, mas só quem gere o catálogo grava nele.

### 6. Edge Functions protegidas

1. As funções de usuário exigem chamador admin. Toda função nova de usuário precisa repetir essa checagem.
2. A sendEmail sem login só envia o aviso de lead, com destinatário fixo e limite de 5 por hora por IP.
3. A notify-pedido só aceita o segredo do webhook, guardado numa tabela que só o admin lê.
4. Todas respondem só aos domínios do portal e não devolvem detalhes de erro.

### 7. Proteções do site

| Proteção | Situação |
|---|---|
| Política de conteúdo (CSP) | Configurada no vercel.json, com coleta das violações pela função csp-report |
| Bloqueio de exibição em moldura (X-Frame-Options) | Ligado |
| Links do banco abertos com segurança | Só https ou caminho interno |
| HTML de materiais | Sanitizado antes de exibir |
| Exportação CSV | Neutraliza fórmulas de planilha |

### 8. Senhas e segredos

- Nenhuma senha é guardada nas tabelas do portal; as colunas antigas foram apagadas em 23/11/2026.
- O site só tem a chave pública; a chave de serviço fica nas Edge Functions.

### Pendências de segurança

Pendências de segurança: ver o documento interno do dono.

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
