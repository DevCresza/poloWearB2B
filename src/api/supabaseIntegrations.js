// Integrações reais com Supabase Storage
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  BUCKET_DOCUMENTOS, EXTENSOES_DOCUMENTO, TAMANHO_MAXIMO_DOCUMENTO,
  caminhoDocumento, pastaDocumento, tipoDocumento,
} from '@/utils/documentos';

// Helper para gerar nome de arquivo único
const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName?.split('.').pop() || 'file';
  const baseName = originalName?.split('.').slice(0, -1).join('.') || 'file';
  // Remove caracteres especiais do nome
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `${cleanBaseName}_${timestamp}_${randomString}.${extension}`;
};

// Sobe um documento de pedido no bucket `documentos`, na pasta do DONO
// (fornecedor/<id> ou cliente/<id>). As policies do bucket recusam upload fora
// da pasta de quem está logado (salvo staff). Ver src/utils/documentos.js.
const enviarDocumento = async ({ file, dono }) => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase não está configurado');
  }
  if (!file) throw new Error('Nenhum arquivo selecionado');

  const contentType = tipoDocumento(file);
  if (!contentType) {
    throw new Error(`Tipo de arquivo não permitido. Use ${EXTENSOES_DOCUMENTO.join(', ').toUpperCase()}.`);
  }
  if ((file.size || 0) > TAMANHO_MAXIMO_DOCUMENTO) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Arquivo muito grande (${mb} MB). O limite é ${TAMANHO_MAXIMO_DOCUMENTO / (1024 * 1024)} MB.`);
  }

  const fileName = generateUniqueFileName(file.name);
  const filePath = `${pastaDocumento(dono)}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType,
      upsert: false
    });

  if (error) {
    console.error('Erro no upload:', error);
    throw new Error(error.message || 'Erro ao fazer upload do arquivo');
  }

  return { filePath, fileName, contentType };
};

export const supabaseIntegrations = {
  // Upload de documento de pedido (NF, XML, boleto, comprovante).
  // `dono`: { fornecedorId } ou { clienteId } — de quem é o documento.
  // file_url é a REFERÊNCIA guardada no banco (formato público); para abrir,
  // use abrirUrlSegura()/urlAssinadaDocumento(), que assinam na hora.
  UploadFile: async ({ file, dono }) => {
    const { filePath, fileName, contentType } = await enviarDocumento({ file, dono });

    const { data: urlData } = supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .getPublicUrl(filePath);

    return {
      success: true,
      file_url: urlData.publicUrl,
      url: urlData.publicUrl,
      file_path: filePath,
      filename: fileName,
      original_name: file.name,
      size: file.size || 0,
      mime_type: contentType,
      uploaded_at: new Date().toISOString(),
    };
  },

  // Upload sem URL de referência: devolve só o caminho.
  UploadPrivateFile: async ({ file, dono }) => {
    const { filePath, fileName, contentType } = await enviarDocumento({ file, dono });
    return {
      success: true,
      file_path: filePath,
      filename: fileName,
      original_name: file.name,
      size: file.size || 0,
      mime_type: contentType,
      uploaded_at: new Date().toISOString(),
    };
  },

  // Criar URL assinada para arquivo privado
  CreateFileSignedUrl: async ({ file_path, expires_in = 3600 }) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase não está configurado');
    }

    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .createSignedUrl(caminhoDocumento(file_path) || file_path, expires_in);

      if (error) {
        console.error('Erro ao criar URL assinada:', error);
        throw error;
      }

      return {
        success: true,
        signed_url: data.signedUrl,
        file_path,
        expires_in,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      };
    } catch (error) {
      console.error('Erro ao criar URL assinada:', error);
      throw new Error(error.message || 'Erro ao criar URL assinada');
    }
  },

  // Deletar arquivo
  DeleteFile: async ({ file_path }) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase não está configurado');
    }

    try {
      const { error } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .remove([caminhoDocumento(file_path) || file_path]);

      if (error) {
        console.error('Erro ao deletar arquivo:', error);
        throw error;
      }

      return {
        success: true,
        file_path,
        deleted_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      throw new Error(error.message || 'Erro ao deletar arquivo');
    }
  },
};
