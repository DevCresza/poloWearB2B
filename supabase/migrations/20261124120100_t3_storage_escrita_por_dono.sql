-- T3 (diagnóstico A2), parte 2 de 2: Storage com escrita por dono, leitura por quem tem o
-- pedido e limites de tamanho e tipo.
--
-- ANTES: qualquer usuário logado subia, trocava ou removia qualquer arquivo dos
-- buckets `documentos` (NF, XML, boleto, comprovante) e `produtos` (fotos,
-- banners, avatares). Um lojista podia trocar o boleto de outro.
--
-- Depende da parte 1 (20261124120000_t3_funcoes_acesso_documentos).
--
-- ORDEM DE APLICAÇÃO: o front novo (uploads em pasta por dono) precisa estar no
-- ar ANTES desta migração. O front antigo sobe tudo em `uploads/`, que aqui
-- passa a ser só de staff. Aplicar depois das 20h (mexe nas policies de
-- storage.objects).
--
-- Esta migração NÃO fecha o bucket `documentos` (continua public = true). O
-- fechamento é outro passo, combinado com o dono:
-- supabase/scripts/t3_fechar_bucket_documentos.sql.
--
-- Pastas no bucket `documentos`:
--   fornecedor/<fornecedor_id>/…  NF, XML, boleto (o fornecedor; staff por ele)
--   cliente/<user_id>/…           comprovante (o cliente; staff por ele)
--   uploads/…                     arquivos antigos: só staff altera; continua
--                                 lendo quem tinha acesso pelo pedido
-- Staff aqui = admin e vendedor (ve_todos_pedidos()): os papéis que veem
-- pedidos. Cadastro não lida com pedido e não entra.
--
-- Pastas no bucket `produtos`:
--   banners/, recursos/   só admin (mesma regra das tabelas banners/recursos)
--   avatars/<user_id>/…   o próprio usuário (e admin)
--   resto (produtos/, otimizadas/…)  pode_gerir_catalogo(), regra do catálogo
--
-- Como: storage.objects é do supabase_storage_admin; o postgres cria policy
-- nela, mas não altera nem remove as dos outros. Então as policies antigas
-- (permissivas, "qualquer logado") ficam e entram policies RESTRITIVAS, que o
-- Postgres combina com AND: a escrita só passa se a antiga E a nova deixarem.
-- Cada restritiva só olha o próprio bucket (bucket_id <> '...' or regra).
--
-- ROLLBACK (volta o comportamento anterior; funções e tabela novas ficam
-- inertes e podem ficar):
--   drop policy if exists documentos_escrita_dono_insert on storage.objects;
--   drop policy if exists documentos_escrita_dono_update on storage.objects;
--   drop policy if exists documentos_escrita_dono_remove on storage.objects;
--   drop policy if exists documentos_leitura_acesso on storage.objects;
--   drop policy if exists produtos_escrita_catalogo_insert on storage.objects;
--   drop policy if exists produtos_escrita_catalogo_update on storage.objects;
--   drop policy if exists produtos_escrita_catalogo_remove on storage.objects;
--   update storage.buckets set file_size_limit = 524288000,
--     allowed_mime_types = array['application/pdf','application/xml','text/xml','image/jpeg','image/jpg','image/png','image/webp','application/octet-stream','text/plain']
--     where id = 'documentos';
--   update storage.buckets set allowed_mime_types = array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
--     where id = 'produtos';

-- ---------------------------------------------------------------------------
-- 3. Policies de storage.objects
-- ---------------------------------------------------------------------------

-- documentos: escrita só na pasta do dono (ou staff)
create policy documentos_escrita_dono_insert on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'documentos' or public.pode_escrever_documento(name));

create policy documentos_escrita_dono_update on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'documentos' or public.pode_escrever_documento(name))
  with check (bucket_id <> 'documentos' or public.pode_escrever_documento(name));

create policy documentos_escrita_dono_remove on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'documentos' or public.pode_escrever_documento(name));

-- documentos: leitura por quem tem o pedido. Hoje soma com a leitura pública
-- ("Qualquer um pode visualizar documentos"); passa a valer sozinha quando o
-- bucket fechar (supabase/scripts/t3_fechar_bucket_documentos.sql).
create policy documentos_leitura_acesso on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and public.pode_ler_documento(name));

-- produtos: regra do catálogo; banners/recursos só admin; avatar só o dono
create policy produtos_escrita_catalogo_insert on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'produtos' or public.pode_escrever_produtos_storage(name));

create policy produtos_escrita_catalogo_update on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'produtos' or public.pode_escrever_produtos_storage(name))
  with check (bucket_id <> 'produtos' or public.pode_escrever_produtos_storage(name));

create policy produtos_escrita_catalogo_remove on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'produtos' or public.pode_escrever_produtos_storage(name));

-- ---------------------------------------------------------------------------
-- 4. Limites dos buckets
-- ---------------------------------------------------------------------------
-- documentos: 20 MB (o maior arquivo hoje tem 10,3 MB) e só pdf, xml e imagem.
-- Sai application/octet-stream e text/plain (nenhum arquivo usa) e image/jpg
-- (não é tipo real; o front manda image/jpeg). text/xml fica: 332 XML de NF-e
-- chegaram assim.
update storage.buckets
   set file_size_limit = 20971520,
       allowed_mime_types = array['application/pdf', 'application/xml', 'text/xml',
                                  'image/jpeg', 'image/png', 'image/webp']
 where id = 'documentos';

-- produtos: aceita PDF para os materiais da página Recursos, que saem do
-- bucket documentos (que vai fechar). Escrita em recursos/ só admin.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp',
                                  'image/gif', 'application/pdf']
 where id = 'produtos';
