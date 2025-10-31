// Storage Helpers - Gerenciamento de imagens no Supabase Storage
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const BUCKET_NAME = 'produtos';

/**
 * Gera um nome único para o arquivo
 * @param {string} originalName - Nome original do arquivo
 * @returns {string} Nome único do arquivo
 */
const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

  return `${sanitized}-${timestamp}-${random}.${extension}`;
};

/**
 * Faz upload de uma imagem para o Supabase Storage
 * @param {File} file - Arquivo a ser enviado
 * @param {string} folder - Pasta dentro do bucket (ex: 'produtos', 'marcas')
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
export const uploadImage = async (file, folder = 'produtos') => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado');
    }

    if (!file) {
      throw new Error('Nenhum arquivo fornecido');
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF');
    }

    // Validar tamanho (50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB em bytes
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 50MB');
    }

    // Gerar nome único
    const fileName = generateUniqueFileName(file.name);
    const filePath = `${folder}/${fileName}`;


    // Upload para o Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // Obter URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);


    return {
      success: true,
      url: publicUrl,
      path: filePath,
      fileName: fileName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao fazer upload da imagem'
    };
  }
};

/**
 * Faz upload de múltiplas imagens
 * @param {FileList|Array<File>} files - Arquivos a serem enviados
 * @param {string} folder - Pasta dentro do bucket
 * @returns {Promise<Array<{success: boolean, url?: string, path?: string, error?: string}>>}
 */
export const uploadMultipleImages = async (files, folder = 'produtos') => {
  const filesArray = Array.from(files);
  const uploadPromises = filesArray.map(file => uploadImage(file, folder));

  return await Promise.all(uploadPromises);
};

/**
 * Deleta uma imagem do Supabase Storage
 * @param {string} filePath - Caminho do arquivo (ex: 'produtos/imagem-123.jpg')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteImage = async (filePath) => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado');
    }

    if (!filePath) {
      throw new Error('Caminho do arquivo não fornecido');
    }


    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw error;
    }


    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar imagem'
    };
  }
};

/**
 * Deleta múltiplas imagens
 * @param {Array<string>} filePaths - Array de caminhos dos arquivos
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteMultipleImages = async (filePaths) => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado');
    }

    if (!filePaths || filePaths.length === 0) {
      throw new Error('Nenhum arquivo para deletar');
    }


    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (error) {
      throw error;
    }


    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar imagens'
    };
  }
};

/**
 * Obtém a URL pública de uma imagem
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} URL pública da imagem
 */
export const getImageUrl = (filePath) => {
  if (!isSupabaseConfigured() || !filePath) {
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrl;
};

/**
 * Extrai o caminho do arquivo de uma URL do Supabase Storage
 * @param {string} url - URL completa da imagem
 * @returns {string|null} Caminho do arquivo ou null
 */
export const extractPathFromUrl = (url) => {
  if (!url) return null;

  try {
    // URL format: https://[project].supabase.co/storage/v1/object/public/produtos/[path]
    const match = url.match(/\/storage\/v1\/object\/public\/produtos\/(.+)$/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};

/**
 * Lista arquivos em uma pasta do bucket
 * @param {string} folder - Pasta a ser listada
 * @returns {Promise<{success: boolean, files?: Array, error?: string}>}
 */
export const listImages = async (folder = 'produtos') => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado');
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      files: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao listar imagens'
    };
  }
};

/**
 * Faz download de uma imagem
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<{success: boolean, blob?: Blob, error?: string}>}
 */
export const downloadImage = async (filePath) => {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado');
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      throw error;
    }

    return {
      success: true,
      blob: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro ao baixar imagem'
    };
  }
};

export default {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  getImageUrl,
  extractPathFromUrl,
  listImages,
  downloadImage,
};
