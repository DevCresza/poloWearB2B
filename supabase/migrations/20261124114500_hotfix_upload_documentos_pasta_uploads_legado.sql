-- HOTFIX (24/11): upload de NF dando 400 para abas com o bundle ANTIGO do portal.
--
-- Causa: o front antigo (antes do PR #15 / T3, deploy de 24/11 01:12 UTC) sobe
-- todo documento em `documentos/uploads/<arquivo>`. A policy restritiva
-- documentos_escrita_dono_insert (20261124011322_t3_storage_escrita_por_dono)
-- só aceita a pasta do dono (fornecedor/<id>, cliente/<uid>) ou staff. Uma aba
-- aberta antes do deploy continua rodando o JS antigo e recebe 400 (RLS) até
-- ser recarregada. O front publicado já usa a pasta do dono.
--
-- Mitigação TEMPORÁRIA: aceita também INSERT de arquivo solto direto em
-- `uploads/` (sem subpasta) para fornecedor, multimarca e franqueado — os
-- papéis que sobem NF, boleto, XML e comprovante. Admin e vendedor já passavam
-- (ve_todos_pedidos). Só INSERT: UPDATE e DELETE de `uploads/` continuam só de
-- staff, e o upload antigo usa upsert=false com nome aleatório, então não dá
-- para trocar arquivo de ninguém. A leitura segue por pode_ler_documento().
--
-- Retirar quando as abas antigas tiverem saído (o front agora recarrega sozinho
-- quando há deploy novo): migração 20261124..._retira_excecao_uploads, que
-- volta o with check abaixo para a forma original.
--
-- ALTER POLICY (e não drop/create) porque mantém a policy sem janela aberta.
--
-- ROLLBACK (volta a regra do T3):
--   alter policy documentos_escrita_dono_insert on storage.objects
--     with check (bucket_id <> 'documentos' or public.pode_escrever_documento(name));

alter policy documentos_escrita_dono_insert on storage.objects
  with check (
    bucket_id <> 'documentos'
    or public.pode_escrever_documento(name)
    or ( (storage.foldername(name))[1] = 'uploads'
         and coalesce(array_length(storage.foldername(name), 1), 0) = 1
         and public.app_role() in ('fornecedor', 'multimarca', 'franqueado') )
  );
