# M11 — acervo de fotos em versões menores

Executado em 23/11/2026, lote `m11-2026-11-23`.

## O que foi feito

1. **Mapa das referências** às fotos do bucket `produtos` (e ao banner, que estava em `documentos`):

   | Onde | Referências | URLs distintas |
   |---|---:|---:|
   | `produtos.fotos` | 4.274 | 3.656 |
   | `produtos.variantes_cor` (fotos das cores) | 2.646 | 2.219 |
   | `capsulas.imagem_capa_url` | 38 | 38 |
   | `banners.imagem_url` (bucket `documentos`) | 1 | 1 |
   | `pedidos.itens` (cópia no pedido, **não alterada**) | 101.529 | 1.247 |
   | `users.avatar_url` (pasta `avatars/`, fora do escopo) | 8 | 8 |

   Sem outras colunas com URL do bucket. `recursos` usa o bucket `documentos`.
   Produtos + cápsulas + banner usam **3.695 arquivos** distintos.

2. **Versões otimizadas** (`processar.js`, sharp 0.34): orientação EXIF aplicada, no
   máximo 1600 px no lado maior, WebP qualidade 82, chave
   `otimizadas/<caminho original>.webp` no bucket `produtos` (o banner foi para
   `otimizadas/banners/`). Só troca se ficar menor: as 3.695 ficaram.

3. **Envio** (`enviar.js`) por uma Edge Function temporária
   (`edge-function-temporaria/index.ts`), protegida por um segredo aleatório numa
   linha de `app_settings` (só admin lê). Idempotente (`upsert: false`, "já existe" conta
   como ok) e retomável (`enviados.json`). No fim, a função virou um stub que responde
   410 e o segredo foi zerado.

4. **Troca das URLs** (`troca_urls.sql`), numa transação, com o mapa e o "antes" no
   schema `backups` (migração `20261123233618_fotos_otimizadas_backup`).

## Números

| | Antes | Depois |
|---|---:|---:|
| Fotos servidas por produtos/cápsulas/banner | 1.298.366.956 B (1,30 GB) | 221.641.254 B (222 MB) — **−83%** |
| Maior foto servida | 2,4 MB | 496 kB |
| Fotos servidas acima de 1 MB | 208 | 0 |

As 328 fotos do bucket acima de 1 MB: 207 eram usadas por produtos e foram trocadas;
1 só aparece em pedido antigo; 120 não são usadas por nada.

## Backup e rollback

- `backups.fotos_otimizadas` — mapa original → otimizada, com os tamanhos.
- `backups.fotos_otimizadas_troca` — cada URL trocada (6.959): tabela, id, coluna, antiga, nova.
- `backups.fotos_otimizadas_antes` — valor inteiro de cada coluna antes da troca (1.448 linhas).
- **Rollback:** `rollback_troca.sql`. Troca só as strings exatas de volta; edições feitas
  depois (preço, estoque, fotos novas) ficam. Os originais nunca saíram do bucket.

## Nada foi apagado

Nenhum original saiu do Storage. Decisões para o dono **a partir de 23/12/2026**:

- **1.247 originais são usados por pedidos** (`pedidos.itens`): esses **não** podem ser
  apagados, nem depois dos 30 dias (1.113 deles também tinham versão otimizada).
- **2.581 originais** (889 MB) só eram usados por produtos/cápsulas e agora têm versão
  otimizada: podem ser apagados se nada quebrar em 30 dias.
- **1.459 arquivos** (542 MB) não são usados por nada (nem produto, nem pedido), desde
  antes desta tarefa.
- Depois disso, as tabelas `backups.fotos_otimizadas*` podem sair (rollback na migração).
- Pedidos criados a partir de agora guardam a URL `otimizadas/...`: essas versões
  também não podem ser apagadas.
