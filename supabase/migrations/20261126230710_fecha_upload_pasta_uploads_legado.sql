-- Retira a exceção TEMPORÁRIA de 20261124114500_hotfix_upload_documentos_pasta_uploads_legado.
--
-- Motivo: aquela migração reabriu o INSERT de arquivo solto em `documentos/uploads/`
-- para fornecedor, multimarca e franqueado, porque abas com o bundle antigo do
-- portal ainda subiam documentos ali. Desde o PR #29 o portal recarrega sozinho
-- quando sai versão nova, e os logs do Storage não mostram mais envios para
-- `uploads/` (só geração de URL assinada para abrir arquivo antigo, que é
-- leitura e continua liberada por pode_ler_documento()). Volta a regra do T3:
-- grava só a pasta do dono (fornecedor/<id da marca>/, cliente/<id do usuário>/)
-- ou a equipe (ve_todos_pedidos).
--
-- ALTER POLICY (e não drop/create) para não abrir janela sem policy.
--
-- ROLLBACK (volta a exceção de 24/11):
--   alter policy documentos_escrita_dono_insert on storage.objects
--     with check (
--       bucket_id <> 'documentos'
--       or public.pode_escrever_documento(name)
--       or ( (storage.foldername(name))[1] = 'uploads'
--            and coalesce(array_length(storage.foldername(name), 1), 0) = 1
--            and public.app_role() in ('fornecedor', 'multimarca', 'franqueado') )
--     );

alter policy documentos_escrita_dono_insert on storage.objects
  with check (bucket_id <> 'documentos' or public.pode_escrever_documento(name));
