# 9. Modelo de dados

O centro do modelo é o pedido: ele liga comprador, loja e fornecedor, guarda os itens e recebe as notas fiscais e os títulos.

Quantidade de linhas por tabela: ver o documento interno do dono.

### Tabelas principais

| Tabela | O que guarda | Campos-chave |
|---|---|---|
| users | Usuários do portal, um por login | id (o mesmo do login), role, fornecedor_id, bloqueado, total_em_aberto, total_vencido |
| lojas | Unidades dos clientes | user_id (dono), endereço, cnpj, bloqueada, ativa |
| fornecedores | Marcas | pedido_minimo_multimarca, pedido_minimo_franqueado, metodos_pagamento_aceitos, boleto_faturado_prazos_dias, clientes_boleto_faturado |
| produtos | Catálogo | fornecedor_id, tipo_venda, preços por perfil, disponibilidade, controla_estoque, estoque, variantes_cor, data_prevista_entrega, ativo, arquivado |
| capsulas | Kits de coleção | fornecedor_id, produto_ids, produtos_quantidades, meses_disponiveis, disponivel_franqueado, disponivel_multimarca, grupo, ano |
| pedidos | Pedidos | comprador_user_id, loja_id, fornecedor_id, itens (lista), status, status_pagamento, valor_total, valor_final, valor_faturado, valor_quebra, meses_entrega_efetivos, meses_faturamento, idempotency_key |
| faturamentos | Notas fiscais | pedido_id, numero_nf, numero_nf_norm, data_emissao, itens, valor_total, pagamentos |
| carteira | Títulos a receber | pedido_id, faturamento_id, cliente_user_id, loja_id, fornecedor_id, parcela_numero, valor, data_vencimento, status, comprovante_url |
| movimentacoes_estoque | Entradas e saídas de estoque | produto_id, fornecedor_id, pedido_id, tipo, quantidades antes e depois, motivo |
| pedido_historico | Auditoria do pedido | pedido_id, autor, papel, status de e para, campos alterados |
| pedido_notifications_sent | E-mails já enviados por pedido | pedido_id, event_key, recipient |
| notificacoes | Avisos do sino | usuario_id, link |
| metas | Metas mensais | fornecedor_id ou user_id, ano, mes, valor_meta, pecas_meta |
| contacts | Contatos do CRM | — |
| csp_reports | Violações de CSP | directive, blocked_uri, document_uri |
| app_settings | Configurações internas (só admin) | key |

Tabelas menores: banners, recursos, whatsapp_templates, pending_users, franqueados, carrinho_itens e health_checks.

### Visões (consultas prontas)

| Visão | Para que serve |
|---|---|
| pedidos_resumo | Pedidos sem a lista de itens, para listas e o sino |
| carteira_com_pedido | Títulos com os dados do pedido e do cliente, para a Carteira |
| carteira_totais_cliente_fornecedor | Em aberto e vencido por cliente e fornecedor |
| vw_conferencia_cobranca | Nota a nota: faturado contra títulos |

Todas respeitam as regras de acesso de quem consulta.

### Como os itens ficam no pedido

Cada item da lista "itens" do pedido traz:

| Campo | Significado |
|---|---|
| produto_id, nome, referência | O produto |
| tipo_venda, total_pecas_grade | Grade ou unidade |
| quantidade, preco, total | Quantidade, preço unitário e total do item |
| cor_selecionada, tamanho_selecionado | A variação comprada |
| origem_capsula | A cápsula de onde o item veio |
| mes_entrega | O mês escolhido na cápsula |
| quantidades faturadas e de quebra | O que já saiu em nota ou foi perdido |

### Outros esquemas

| Esquema | Conteúdo | Acesso pela API |
|---|---|---|
| backups | Cópias feitas antes de cada correção de dados | Nenhum |
| interno | Tabelas de apoio das regras (mapa de documentos antigos e mês de produtos apagados) | Nenhum |
| storage | Arquivos (buckets produtos, documentos e assets) | Pelas regras do Storage |

### Diagrama

```mermaid
flowchart LR
  subgraph g1["Pessoas"]
    n1["users"]
    n2["lojas"]
    n3["fornecedores"]
  end
  subgraph g2["Catálogo"]
    n4["produtos"]
    n5["capsulas"]
    n6["movimentacoes_estoque"]
  end
  subgraph g3["Pedido"]
    n7["pedidos"]
    n8["pedido_historico"]
    n9["pedido_notifications_sent"]
  end
  subgraph g4["Financeiro"]
    n10["faturamentos"]
    n11["carteira"]
  end
  subgraph g5["Gestão"]
    n12["metas"]
    n13["notificacoes"]
  end
  n2 -->|"user_id (dono da loja)"| n1
  n1 -->|"fornecedor_id (usuário da marca)"| n3
  n3 -->|"responsavel_user_id"| n1
  n4 -->|"fornecedor_id"| n3
  n5 -->|"fornecedor_id"| n3
  n5 -->|"produto_ids (lista)"| n4
  n7 -->|"comprador_user_id"| n1
  n7 -->|"criado_por_user_id e emitido_por_admin_user_id"| n1
  n7 -->|"loja_id"| n2
  n7 -->|"fornecedor_id"| n3
  n7 -->|"itens[].produto_id (dentro da lista)"| n4
  n7 -->|"itens[].origem_capsula (dentro da lista)"| n5
  n10 -->|"pedido_id"| n7
  n11 -->|"pedido_id"| n7
  n11 -->|"faturamento_id"| n10
  n11 -->|"cliente_user_id"| n1
  n11 -->|"loja_id"| n2
  n11 -->|"fornecedor_id"| n3
  n6 -->|"produto_id"| n4
  n6 -->|"pedido_id"| n7
  n6 -->|"fornecedor_id"| n3
  n8 -->|"pedido_id (sem chave estrangeira, para sobreviver à exclusão)"| n7
  n9 -->|"pedido_id"| n7
  n12 -->|"fornecedor_id"| n3
  n12 -->|"user_id"| n1
  n13 -->|"usuario_id"| n1
```

### Perguntas em aberto

- As colunas antigas sem uso (users.permissoes, faturamentos.valor_cartao, users.tipo_negocio redundante) podem ser removidas?
- As tabelas de backup do esquema backups podem ser apagadas depois de quanto tempo?

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
