-- T3 (diagnóstico A2), passo final: fechar o bucket `documentos`.
--
-- APLICADA em produção em 24/11/2026, 01:13 UTC (22:13 de Brasília; versão 20261124011345), com o OK
-- do dono, depois de:
--   1. merge do PR #15 (front que abre documento por URL assinada), deploy de
--      produção conferido (commit 7191aef, status success);
--   2. sendEmail v11 e enviarCobrancaVencimento v5 no ar (link de e-mail
--      assinado por 60 dias);
--   3. migrações 20261124010534_t3_funcoes_acesso_documentos e
--      20261124011322_t3_storage_escrita_por_dono aplicadas.
--
-- Efeito: a URL pública (…/object/public/documentos/…) para de abrir para todo
-- mundo, inclusive links de e-mails antigos (aceito pelo dono). O portal abre
-- os arquivos por URL assinada de 1 hora; quem lê:
--   staff (admin, vendedor), o dono da pasta, e a outra parte do pedido
--   (public.documento_acessivel). Anon não lê nada.
--
-- As policies antigas de leitura ("Qualquer um pode visualizar documentos",
-- permissiva, para todos) continuam lá: o postgres não altera policy de
-- storage.objects. As restritivas abaixo cortam com AND.
--
-- Atenção: 1 capa de recurso antigo (recursos.thumbnail_url) está no bucket
-- documentos e é exibida com <img>; depois de fechar, reenviar essa capa pela
-- página Recursos (vai para o bucket produtos, público).
--
-- ROLLBACK (reabre como antes):
--   update storage.buckets set public = true where id = 'documentos';
--   drop policy if exists documentos_fechado_anon on storage.objects;
--   drop policy if exists documentos_fechado_leitura on storage.objects;

-- Foto das referências de arquivos antigos atualizada no momento do fechamento
-- (pega o que entrou desde a migração de escrita).
select interno.popular_documentos_legado();

create policy documentos_fechado_anon on storage.objects
  as restrictive for select to anon
  using (bucket_id <> 'documentos');

create policy documentos_fechado_leitura on storage.objects
  as restrictive for select to authenticated
  using (bucket_id <> 'documentos' or public.pode_ler_documento(name));

update storage.buckets set public = false where id = 'documentos';
