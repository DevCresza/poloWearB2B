# 14. Histórico de mudanças de novembro de 2026

Em novembro, o portal passou por um diagnóstico completo em 23/11 e por cerca de 30 correções em dois dias, da segurança ao faturamento.

Datas e horas no horário de Brasília (data do merge no main). Da mais nova para a mais antiga.

| Data | Mudança | PR |
|---|---|---|
| 26/11, 20h07 | Pasta antiga de documentos (uploads/) volta a ser só leitura para fornecedor e cliente | #36 |
| 24/11, 20h52 | Regras de acesso mais rápidas aplicadas em todas as tabelas; fornecedor preenchido nos títulos provisórios | #34 |
| 24/11, 20h44 | Produto apagado não muda o mês de entrega; produto e cápsula com pedido só se arquivam | #33 |
| 24/11, 20h21 | Mês de entrega recalculado quando o fornecedor muda a data prevista do pedido | #31 |
| 24/11, 11h08 | Envio para várias lojas sem pedido em dobro num clique duplo | #32 |
| 24/11, 09h57 | Mês de entrega dos pedidos defasados corrigido (conciliação) | #30 |
| 24/11, 08h52 | Upload de NF de abas antigas volta a passar; o portal recarrega quando há deploy novo | #29 |
| 24/11, 08h44 | Regras de acesso mais rápidas, índices, conferência de cobrança 5 vezes mais rápida e estoque por fornecedor | #28 |
| 23/11, 23h19 | Relatórios no horário de Brasília, peças por tamanho e vencido sem o dia de hoje | #27 |
| 23/11, 23h01 | Atualizações seguras de bibliotecas juntas, com o alerta do GitHub configurado | #21 |
| 23/11, 22h43 | Estorno automático de estoque ligado; cancelados antigos desmarcados sem estorno | #20 |
| 23/11, 22h29 | Faturamento retroativo dos casos especiais | #19 |
| 23/11, 22h24 | Faturamento retroativo dos pedidos faturados sem registro | #18 |
| 23/11, 22h18 | Pedido criado no servidor (criar_pedido) e estoque com trava | #17 |
| 23/11, 22h15 | Registro das migrações do Storage e fechamento do bucket de documentos | #16 |
| 23/11, 22h11 | NF, boleto e comprovante protegidos: escrita por dono e leitura por link assinado | #15 |
| 23/11, 22h08 | Faturamento numa transação só (registrar_faturamento) | #14 |
| 23/11, 21h42 | Parcelas sem cobrança em dobro (substituir_parcelas) e camada de dados que avisa quando nada muda | #13 |
| 23/11, 21h02 | Fotos antigas em WebP de até 1600 px: de 1,30 GB para 222 MB | #12 |
| 23/11, 20h58 | Travas no banco: pedido, bloqueio, carteira e senhas gravadas apagadas | #4 |
| 23/11, 20h42 | Painéis, metas, carteira e lote param de baixar a base inteira (de até 90 MB para poucos kB) | #11 |
| 23/11, 20h37 | Coleta de violações da CSP e app antigo fora do CORS, com redirecionamento | #10 |
| 23/11, 20h02 | Segurança no front (links seguros, CSV, HTML sanitizado, cabeçalhos) e bibliotecas atualizadas | #2 |
| 23/11, 19h13 | Sino leve e site em partes: Lighthouse no celular de 67 para 97 | #3 |
| 23/11, 19h01 | E-mail e cobrança deixam de aceitar chamada sem login; código das 8 Edge Functions no repositório | #1 |
| 23/11, 18h31 | Visão de pedidos e backups fechados ao acesso sem login (hotfix aplicado direto no banco) | Migração, registrada no #1 |
| 23/11 | Diagnóstico completo do código, do banco e da produção | — |
| 17/11 | Pedido de lote: só a administração cancela | Sem PR |
| 09/11 | Meus Pedidos no celular de 8,3 MB para 791 kB | Sem PR |
| 09/11 | Uma regra só para o mês de faturamento; tela do fornecedor de 72 MB para 6 MB | Sem PR |
| 09/11 | Lista de pedidos do admin de 14 MB para 4 MB; faturar volta a funcionar | Sem PR |
| 09/11 | Mesma nota com o mesmo valor não entra duas vezes no pedido | Sem PR |
| 09/11 | Fornecedor só escreve no próprio faturamento; ordem das linhas de cápsula | Sem PR |
| 09/11 | Segunda nota fiscal para de sumir; cápsulas em linhas no catálogo | Sem PR |

Os PRs de 5 a 9 e de 22 a 26 são atualizações automáticas de bibliotecas (Dependabot). Os de 5 a 9 foram substituídos pelo #21; os de 22 a 26 são atualizações grandes que aguardam a tarefa própria.

### Números de antes e depois

| Indicador | Antes | Depois | PR |
|---|---|---|---|
| Lighthouse no celular (desempenho, medido no PR) | 67 | 97 | #3 |
| Tempo do banco gasto pelo sino | 65% do total | Fora do topo | #3 |
| Painel do admin ao abrir | ~90 MB | ~9 kB | #11 |
| Metas ao abrir | 78 MB por meta | menos de 1 kB | #11 |
| Carteira (admin) ao abrir | 8,5 MB + 7.577 buscas | ~60 kB por página | #11 |
| Fotos do catálogo | 1,30 GB | 222 MB | #12 |
| Conferência de cobrança | 3,4 s | ~0,7 s (~20 ms com as regras rápidas) | #28 |

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
