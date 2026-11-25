# 11. Funções e automações do banco

As regras que mexem com dinheiro, estoque e datas rodam em funções e gatilhos do banco, para valerem igual em qualquer tela.

### Funções que o portal chama

| Função | Para que serve | Quem pode |
|---|---|---|
| criar_pedido | Checkout: monta itens com preço do banco, valida mínimo, bloqueio, endereço, pagamento e estoque; grava pedido, baixa estoque e cria o título provisório | Cliente; vendedor e admin em nome de cliente |
| emitir_pedido_lote | Pedido de uma cápsula para uma loja, sem mínimo e sem baixa de estoque | Admin |
| registrar_faturamento | Grava a NF, os itens faturados, os títulos das partes que não são boleto e os valores do pedido, com o pedido travado | Admin ou fornecedor do pedido |
| substituir_parcelas | Troca as parcelas de boleto de uma nota (ou do pedido sem nota), preservando pagos e em análise | Admin ou fornecedor do pedido |
| kpis_dashboard | Cartões dos painéis: pedidos por situação, carteira e produtos | Logados (cada um vê o seu) |
| kpis_dashboard_admin | Gráficos e listas do painel da administração | Logados (na prática, admin) |
| metas_realizado | Realizado de todas as metas de um mês | Logados |
| carteira_resumo | Cartões da Carteira: em aberto, vencido, vence em 7 dias e pago | Logados |
| get_produtos_mais_vendidos | Ranking de produtos | Logados |
| estoque_automatico_ativo | Diz à tela que o estoque é automático | Logados |
| data_br, hoje_br, inicio_dia_br_utc | Datas no horário de Brasília | Logados |
| pecas_item | Peças de um item (grade inteira ou por tamanho) | Logados |
| calc_meses_entrega_efetivos, calc_meses_faturamento | Meses de entrega e de faturamento | Logados |
| pode_ler_documento, pode_escrever_documento, documento_acessivel | Regras de acesso aos arquivos | Logados e Edge Functions |
| produtos_com_pedidos, capsulas_com_pedidos | Diz quais itens têm pedido (para esconder o botão Excluir) | Quem gere o catálogo |
| delete_user_complete | Apaga um usuário e seus vínculos | Admin |

### Gatilhos

| Tabela | Gatilho | O que faz |
|---|---|---|
| pedidos | trg_pedidos_guard_insert | Força o estado inicial e recusa pedido inválido ou bloqueado |
| pedidos | trg_pedidos_guard_colunas | Trava colunas e mudanças de situação por papel |
| pedidos | trg_pedidos_bloqueia_cancelar_lote | Só admin cancela pedido de lote |
| pedidos | trg_pedidos_calc_resumo | Calcula peças e meses de entrega quando mudam itens, data prevista ou data do pedido |
| pedidos | trg_pedidos_zz_estoque | Devolve o estoque ao cancelar (uma vez) e acerta a diferença na revisão de itens |
| pedidos | trg_cascade_cancelar_carteira | Pedido cancelado cancela os títulos em aberto (pagos ficam) |
| pedidos | trg_cascade_pagamento_carteira | Pedido marcado como pago marca os títulos pendentes como pagos |
| pedidos | trg_pedidos_historico | Grava quem mudou o quê no histórico |
| pedidos | trg_notify_pedido_change | Chama a notify-pedido (e-mails) via pg_net |
| carteira | trg_carteira_a_fornecedor_do_pedido | Preenche o fornecedor do título a partir do pedido |
| carteira | trg_carteira_guard_colunas | Trava colunas do título por papel |
| carteira | trg_carteira_sync_totais | Recalcula os totais em aberto e vencido do cliente |
| carteira | trg_notify_carteira_change | Chama a notify-pedido para comprovantes e pagamentos |
| faturamentos | trg_faturamentos_meses | Mantém os meses de faturamento do pedido |
| produtos | trg_produtos_propagar_meses | Mudança da data prevista do produto recalcula os meses dos pedidos |
| produtos e capsulas | bloqueia_excluir_com_pedido | Recusa exclusão de item com pedido |
| users | trg_users_guard_privilegios | Trava papel, limite, fornecedor, bloqueio e totais |
| lojas | trg_lojas_guard_colunas | Trava bloqueio e dono da loja |
| movimentacoes_estoque | trg_movimentacoes_fornecedor | Preenche a marca a partir do produto |
| várias | update_updated_at_column | Atualiza a data de alteração |

Os gatilhos de guarda rodam em ordem alfabética do nome. Por isso alguns começam com "a_" ou "zz_".

### Tarefas agendadas

| Tarefa | Horário (Brasília) | Função |
|---|---|---|
| recalcular-totais-carteira | Todo dia, 03h10 | recalcular_totais_cliente() |
| daily-health-check | Todo dia, 03h00 | perform_health_check() |
| csp_reports_limpeza_30d | Todo dia, 00h17 | Apaga relatórios de CSP antigos |

### E-mails

| Origem | Como funciona |
|---|---|
| notify-pedido | O gatilho de pedidos e de carteira manda a mudança via pg_net, com o segredo do webhook. A função decide o e-mail, monta o HTML com os campos escapados e envia pelo Resend |
| Registro de envio | Cada e-mail fica em pedido_notifications_sent, por pedido, evento e destinatário. O mesmo e-mail não sai duas vezes |
| sendEmail | E-mails pedidos pelo portal (credenciais, NF, aviso de lead). Links de documentos são assinados no servidor, válidos por 60 dias |
| enviarCobrancaVencimento | Cobrança dos títulos que vencem no dia. Hoje só por chamada de admin |

O remetente é nao-responda@info.portalpolowear.com.br, domínio verificado no Resend.

### Eventos de e-mail da notify-pedido

| Evento | Destinatário |
|---|---|
| Pedido criado | E-mails do fornecedor |
| Situação: em produção, faturado, em transporte, entregue, cancelado | Comprador |
| Pagamento do pedido confirmado | Comprador |
| Boleto, PIX ou NF anexados ao pedido | Comprador |
| Itens revisados | Comprador |
| Comprovante enviado | Fornecedor |
| Comprovante recusado ou aprovado | Comprador |

### Perguntas em aberto

Ver o documento interno do dono.

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
