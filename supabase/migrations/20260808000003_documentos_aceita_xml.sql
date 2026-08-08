-- O fornecedor passou a poder anexar o XML da NF-e no lugar do PDF. O bucket
-- `documentos` so aceitava pdf/imagem/texto, entao o upload voltava
-- "mime type not supported" antes de chegar no pedido.
--
-- Navegadores reportam .xml ora como text/xml, ora como application/xml.

update storage.buckets
   set allowed_mime_types = array[
     'application/pdf',
     'application/xml',
     'text/xml',
     'image/jpeg',
     'image/jpg',
     'image/png',
     'image/webp',
     'application/octet-stream',
     'text/plain'
   ]
 where id = 'documentos';
