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
