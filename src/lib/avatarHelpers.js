/**
 * Helpers para upload de avatares de usuários
 * Usa o bucket 'produtos' com pasta 'avatars'
 */

import { supabase } from './supabase';

/**
 * Upload de avatar do usuário
 * @param {File} file - Arquivo de imagem
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} URL do avatar e path
 */
export const uploadAvatar = async (file, userId) => {
  try {
    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.');
    }

    // Validar tamanho (máx 5MB para avatar)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. O tamanho máximo é 5MB.');
    }

    // Criar nome único para o arquivo
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const fileName = `avatar-${userId}-${timestamp}.${extension}`;
    const filePath = `avatars/${fileName}`;

    console.log(`📤 Fazendo upload de avatar: ${filePath}`);

    // Upload para o bucket 'produtos' na pasta 'avatars'
    const { data, error } = await supabase.storage
      .from('produtos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Erro no upload:', error);
      throw error;
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('produtos')
      .getPublicUrl(filePath);

    console.log('✅ Avatar enviado com sucesso:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      path: filePath
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload do avatar:', error);
    throw error;
  }
};

/**
 * Deletar avatar do usuário
 * @param {string} avatarUrl - URL do avatar a deletar
 * @returns {Promise<boolean>} true se deletado com sucesso
 */
export const deleteAvatar = async (avatarUrl) => {
  try {
    if (!avatarUrl) return false;

    // Extrair o path da URL
    const path = extractPathFromUrl(avatarUrl);

    if (!path) {
      console.warn('⚠️ Path não encontrado na URL:', avatarUrl);
      return false;
    }

    console.log(`🗑️ Deletando avatar: ${path}`);

    const { error } = await supabase.storage
      .from('produtos')
      .remove([path]);

    if (error) {
      console.error('❌ Erro ao deletar:', error);
      throw error;
    }

    console.log('✅ Avatar deletado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao deletar avatar:', error);
    throw error;
  }
};

/**
 * Extrair path do arquivo a partir da URL pública do Supabase
 * @param {string} url - URL pública do Supabase Storage
 * @returns {string|null} Path do arquivo ou null
 */
const extractPathFromUrl = (url) => {
  try {
    if (!url) return null;

    // URL formato: https://{project}.supabase.co/storage/v1/object/public/produtos/avatars/avatar-xxx.jpg
    const match = url.match(/\/produtos\/(.+)$/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('❌ Erro ao extrair path da URL:', error);
    return null;
  }
};

/**
 * Atualizar avatar do usuário (deleta o antigo e faz upload do novo)
 * @param {File} file - Novo arquivo de imagem
 * @param {string} userId - ID do usuário
 * @param {string} oldAvatarUrl - URL do avatar antigo (opcional)
 * @returns {Promise<Object>} URL do novo avatar
 */
export const updateAvatar = async (file, userId, oldAvatarUrl = null) => {
  try {
    // Deletar avatar antigo se existir
    if (oldAvatarUrl) {
      try {
        await deleteAvatar(oldAvatarUrl);
      } catch (error) {
        console.warn('⚠️ Não foi possível deletar avatar antigo:', error);
        // Continua mesmo se falhar ao deletar o antigo
      }
    }

    // Upload do novo avatar
    return await uploadAvatar(file, userId);
  } catch (error) {
    console.error('❌ Erro ao atualizar avatar:', error);
    throw error;
  }
};

/**
 * Obter avatar padrão baseado no nome do usuário
 * @param {string} name - Nome do usuário
 * @returns {string} URL do avatar padrão (iniciais do nome)
 */
export const getDefaultAvatar = (name) => {
  if (!name) return getInitialsAvatar('U');

  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return getInitialsAvatar(initials);
};

/**
 * Gerar URL de avatar com iniciais usando DiceBear API
 * @param {string} initials - Iniciais do usuário
 * @returns {string} URL do avatar gerado
 */
const getInitialsAvatar = (initials) => {
  // Usando DiceBear API para gerar avatares baseados em iniciais
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=3b82f6&textColor=ffffff`;
};
