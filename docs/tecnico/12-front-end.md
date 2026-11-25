# 12. Front-end

O site é uma aplicação React de página única. Cada tela é um arquivo em src/pages, protegido por uma guarda de rota que consulta o papel.

### Organização do código

| Pasta | Conteúdo |
|---|---|
| src/pages | Uma tela por arquivo; index.jsx tem as rotas; Layout.jsx tem o menu por papel |
| src/components | Componentes de tela; pedidos/, admin/, crm/, estoque/, recursos/, vendedor/ e ui/ (shadcn) |
| src/contexts | Login (AuthContext), loja selecionada (LojaContext) e compra em nome de cliente (RepresentacaoContext) |
| src/api | Acesso ao Supabase: entidades, login, funções do banco e envio de arquivos |
| src/utils | Regras compartilhadas: papéis, permissões, preço, itens, cápsulas, datas, documentos e exportação |
| src/lib | Cliente do Supabase e helpers de Storage, CEP e avatar |
| src/hooks | Hooks de tela (título da página, celular, notificações) |
| supabase/migrations | Migrações do banco, com rollback em comentário |
| supabase/functions | Código das Edge Functions |
| supabase/conciliacao e supabase/scripts | Correções de dados aplicadas, com rollback |

### Rotas por papel

Telas públicas: Home, Login, reset-password e CadastroCompra (cadastro de lead).

| Rota | Permissão exigida | Papéis |
|---|---|---|
| PortalDashboard | Ver painel | Todos |
| MeuPerfil | Estar logado | Todos |
| Recursos | Ver materiais | Todos |
| Catalogo | Ver catálogo | Admin, multimarca, franqueado, cadastro, vendedor |
| Carrinho | Fazer pedidos | Admin, multimarca, franqueado, vendedor |
| MeusPedidos | Ver meus pedidos | Admin, multimarca, franqueado |
| CarteiraFinanceira | Ver carteira | Admin, fornecedor, multimarca, franqueado |
| HistoricoCompras | Ver carteira | Admin, fornecedor, multimarca, franqueado |
| PedidosAdmin | Ver todos os pedidos | Admin, vendedor |
| PedidosFornecedor | Ver pedidos do fornecedor | Admin, fornecedor |
| HistoricoEmails | Gerenciar pedidos | Admin, fornecedor |
| EmissaoLote | Emitir lote | Admin |
| GestaoProdutos | Editar produtos | Admin, fornecedor, cadastro |
| GestaoCapsulas | Gerenciar cápsulas | Admin, fornecedor, cadastro |
| GestaoEstoque | Gerenciar estoque | Admin, fornecedor |
| DashboardAdmin | Ver relatórios | Admin |
| Admin, ConfigWhatsApp | Configurar sistema | Admin |
| UserManagement | Gerenciar usuários | Admin |
| GestaoClientes | Gerenciar clientes | Admin |
| GestaoFornecedores | Gerenciar fornecedores | Admin |
| CrmDashboard | Ver CRM | Admin |
| GestaoMetas | Ver metas | Admin |

### Peças compartilhadas que toda tela nova deve usar

| Peça | Arquivo | Uso |
|---|---|---|
| Papéis | src/utils/roles.js | getPapel, isAdmin, isCliente e afins; role é a fonte de verdade |
| Permissões | src/utils/permissoes.js | can(user, PERM.X) e PERMISSAO_POR_PAGINA |
| Guarda de rota | src/components/ProtectedRoute.jsx | Envolve toda rota logada |
| Entidades | src/api/supabaseEntities.js | createSupabaseEntity('tabela'): list, filter, get, create, update, delete, com escolha de colunas |
| Erros das entidades | EntidadeError e SEM_LINHAS | Erro com o código do banco; alteração que não atinge nenhuma linha dá erro |
| Pedido | src/api/pedidos.js | criarPedido (chama criar_pedido) |
| Faturamento | src/api/faturamento.js | registrarFaturamento |
| Parcelas | src/api/parcelas.js | substituirParcelas |
| Indicadores | src/api/kpis.js | kpis_dashboard, metas_realizado, carteira_resumo |
| Catálogo | src/api/catalogo.js | Diz quais produtos e cápsulas têm pedido (esconde o Excluir) |
| Preço e itens | src/utils/precoCliente.js e itemPedido.js | Preço por perfil e peças por item, iguais ao banco |
| Cápsulas | src/utils/capsulaItens.js | Expande a cápsula em itens para mostrar valores |
| Pedido mínimo | src/utils/pedidoMinimo.js | Aviso antes de enviar (o banco decide) |
| Datas | src/utils/dataBR.js | hojeBR, mesBR e afins, no horário de Brasília |
| Documentos | src/utils/documentos.js | Pasta do dono e URL assinada |
| Links seguros | src/utils/urlSegura.js | abrirUrlSegura e linkInternoSeguro |
| Fotos | src/utils/thumb.js | Miniatura pela transformação de imagem do Supabase |
| Exportação | src/utils/exportUtils.js | CSV seguro e PDF (jspdf carregado só quando usado) |
| Pagamento dividido | src/utils/divisaoPagamento.js | Divide a nota entre formas, em centavos |
| Vencimentos | src/utils/vencimentoUtils.js | Valida datas de parcelas |
| Leitura de NF-e | src/utils/nfeXml.js | Lê o XML para preencher o faturamento |
| Histórico | src/utils/historicoPedido.js | Traduz a auditoria do pedido para português |
| Versão do site | src/utils/versaoApp.js e AtualizacaoPortal | Avisa e recarrega quando há deploy novo |
| Carga por rota | src/utils/lazyComRecarga.js | Carrega cada tela sob demanda e recarrega uma vez se o arquivo mudou |

### Regras ao mexer no front

1. Não reimplemente checagem de papel na tela: use can() e a guarda de rota.
2. Ao comprar em nome de outro, o "user" do Carrinho é o comprador e "usuarioLogado" é quem opera.
3. Peça só as colunas que a tela usa; nunca baixe a tabela de pedidos inteira.
4. Datas de negócio sempre pelo dataBR.js.
5. Arquivos de pedido sempre pela pasta do dono e abertos por URL assinada.
6. Toda regra de dinheiro vale no banco; a tela só avisa antes.

### Código legado

- src/api/functions.js e os arquivos mock* são do tempo do Base44. Nenhuma tela usa as funções simuladas de lá.
- src/services não é usado pelas telas.
- O pacote @base44/sdk já saiu das dependências.
- A home ainda carrega imagens do Storage do projeto antigo do Base44 (HeroSection e ProductGallery).

### Perguntas em aberto

- Os arquivos legados (mock*, functions.js e src/services) podem ser apagados numa limpeza?

---

Fontes: código do `main`, estrutura do banco de produção Polowear2 (só leitura), PRs #1 a #34 e o diagnóstico de 23/11/2026. Índice: [docs/README.md](../README.md).
