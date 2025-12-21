import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: { 'x-my-custom-header': 'polo-b2b' }
      }
    })
  : null

// Listener para detectar erros de autenticação e limpar tokens inválidos
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('[Auth] Token renovado com sucesso');
    }

    if (event === 'SIGNED_OUT') {
      console.log('[Auth] Usuário deslogado');
      clearAuthStorage();
    }
  });
}

// Função para limpar tokens de autenticação do localStorage
export const clearAuthStorage = () => {
  if (typeof window !== 'undefined') {
    // Limpar tokens do Supabase
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key === 'auth_session') {
        localStorage.removeItem(key);
      }
    });
    console.log('[Auth] Tokens de autenticação removidos');
  }
}

// Função para verificar e tratar erro de refresh token
export const handleAuthError = async (error) => {
  const errorMessage = error?.message || error?.error_description || '';

  // Detectar erros de refresh token inválido
  const isRefreshTokenError =
    errorMessage.toLowerCase().includes('refresh token') ||
    errorMessage.toLowerCase().includes('invalid token') ||
    errorMessage.toLowerCase().includes('jwt expired') ||
    errorMessage.toLowerCase().includes('not authenticated') ||
    error?.code === 'PGRST301' ||
    error?.code === '401';

  if (isRefreshTokenError) {
    console.warn('[Auth] Token de autenticação inválido. Limpando sessão...');
    clearAuthStorage();

    // Fazer logout para garantir limpeza completa
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e) {
        // Ignorar erros no signOut
      }
    }

    return {
      isAuthError: true,
      shouldRedirect: true,
      message: 'Sua sessão expirou. Por favor, faça login novamente.'
    };
  }

  return {
    isAuthError: false,
    shouldRedirect: false,
    message: errorMessage
  };
}

// Helper para converter erro do Supabase
export const handleSupabaseError = (error) => {
  if (error?.message) {
    return {
      success: false,
      error: error.message,
      details: error
    }
  }
  return {
    success: false,
    error: 'Erro desconhecido',
    details: error
  }
}

// Helper para resposta de sucesso
export const handleSupabaseSuccess = (data) => {
  return {
    success: true,
    data
  }
}

// Função para verificar se o usuário está autenticado
export const getCurrentUser = async () => {
  if (!supabase) return null

  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  } catch (error) {
    return null
  }
}

// Função para logout
export const signOut = async () => {
  if (!supabase) return { success: false, error: 'Supabase not configured' }

  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { success: true }
  } catch (error) {
    return handleSupabaseError(error)
  }
}

// Verificar se Supabase está configurado
export const isSupabaseConfigured = () => {
  return supabase !== null
}

export default supabase
