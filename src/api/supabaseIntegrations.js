// Integrações reais com Supabase Storage
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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

export const supabaseIntegrations = {
  // Upload de arquivo para Supabase Storage
  UploadFile: async ({ file, folder = 'uploads' }) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase não está configurado');
    }

    try {
      const fileName = generateUniqueFileName(file.name);
      const filePath = `${folder}/${fileName}`;

      // Upload para o bucket 'documentos'
      const { data, error } = await supabase.storage
        .from('documentos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Erro no upload:', error);
        throw error;
      }

      // Obter URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath);

      return {
        success: true,
        file_url: urlData.publicUrl,
        url: urlData.publicUrl,
        file_path: filePath,
        filename: fileName,
        original_name: file.name,
        size: file.size || 0,
        mime_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      throw new Error(error.message || 'Erro ao fazer upload do arquivo');
    }
  },

  // Upload de arquivo privado
  UploadPrivateFile: async ({ file, folder = 'private' }) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase não está configurado');
    }

    try {
      const fileName = generateUniqueFileName(file.name);
      const filePath = `${folder}/${fileName}`;

      // Upload para o bucket 'documentos-privados' (ou 'documentos' com RLS)
      const { data, error } = await supabase.storage
        .from('documentos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Erro no upload privado:', error);
        throw error;
      }

      return {
        success: true,
        file_path: filePath,
        filename: fileName,
        original_name: file.name,
        size: file.size || 0,
        mime_type: file.type || 'application/octet-stream',
        uploaded_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Erro ao fazer upload privado:', error);
      throw new Error(error.message || 'Erro ao fazer upload do arquivo');
    }
  },

  // Criar URL assinada para arquivo privado
  CreateFileSignedUrl: async ({ file_path, expires_in = 3600 }) => {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase não está configurado');
    }

    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .createSignedUrl(file_path, expires_in);

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
        .from('documentos')
        .remove([file_path]);

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
