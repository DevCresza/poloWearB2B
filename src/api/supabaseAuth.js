// Autenticação com Supabase
import { supabase, isSupabaseConfigured, handleAuthError, clearAuthStorage } from '@/lib/supabase';
import { mockAuth } from './mockAuth';
import { createSupabaseEntity } from './supabaseEntities';

// Mesma camada das outras tabelas: lista paginada (com desempate por id),
// erro com code preservado e erro quando update/delete nao afetam nenhuma linha.
const usersTabela = createSupabaseEntity('users');

// Se Supabase não configurado, usa mock
if (!isSupabaseConfigured()) {
}

export const supabaseAuth = {
  // Login
  async login(email, password) {
    // Se Supabase configurado, usa Supabase
    if (isSupabaseConfigured()) {
      try {
        // Limpar qualquer sessão anterior inválida
        clearAuthStorage();

        // Login com Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }


        // Buscar dados completos do usuário na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (userError) {
          // Se usuário existe no auth mas não na tabela users
          if (userError.code === 'PGRST116') {
            console.warn('[Auth] Usuário existe no auth.users mas não em public.users');
            await supabase.auth.signOut();
            throw new Error('Usuário não encontrado no sistema. Entre em contato com o administrador.');
          }
          throw userError;
        }


        // Atualizar last_login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id);

        return userData;
      } catch (error) {
        throw new Error(error.message || 'Erro ao fazer login');
      }
    }

    // Fallback para Mock
    return await mockAuth.login(email, password);
  },

  // Logout
  async logout() {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.signOut();
        clearAuthStorage();
        if (error) throw error;
        return true;
      } catch (error) {
        clearAuthStorage();
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    return await mockAuth.logout();
  },

  // Me - Verificar usuário autenticado
  async me() {
    if (isSupabaseConfigured()) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
          // Verificar se é erro de refresh token
          const authErrorResult = await handleAuthError(authError);
          if (authErrorResult.isAuthError) {
            throw new Error(authErrorResult.message);
          }
          throw authError;
        }

        if (!user) {
          clearAuthStorage();
          throw new Error('Não autenticado');
        }

        // Buscar dados completos na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) {
          // Verificar se é erro de refresh token
          const authErrorResult = await handleAuthError(userError);
          if (authErrorResult.isAuthError) {
            throw new Error(authErrorResult.message);
          }

          // Se usuário existe no auth mas não na tabela users (erro 406/PGRST116)
          if (userError.code === 'PGRST116') {
            console.warn('[Auth] Usuário existe no auth.users mas não em public.users');
            clearAuthStorage();
            throw new Error('Usuário não encontrado. Por favor, entre em contato com o administrador.');
          }

          throw userError;
        }

        return userData;
      } catch (error) {
        // Verificar se é erro de autenticação
        const authErrorResult = await handleAuthError(error);
        if (authErrorResult.isAuthError) {
          throw new Error(authErrorResult.message);
        }
        throw new Error(error.message || 'Não autenticado');
      }
    }

    // Fallback para Mock
    return await mockAuth.me();
  },

  // Signup
  async signup(userData) {
    if (isSupabaseConfigured()) {
      try {
        const { email, password, ...otherData } = userData;

        // Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        // Criar registro na tabela users
        const { data: insertData, error: createError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email,
            ...otherData,
          }])
          .select();

        if (createError) throw createError;

        // Retornar o primeiro (e único) usuário criado
        const newUser = insertData && insertData.length > 0 ? insertData[0] : null;

        if (!newUser) {
          throw new Error('Usuário criado mas não foi possível recuperar os dados');
        }

        return newUser;
      } catch (error) {
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    return await mockAuth.signup(userData);
  },

  // Verificar se está autenticado (síncrono)
  isAuthenticated() {
    if (isSupabaseConfigured()) {
      // Para Supabase, verificamos de forma assíncrona no me()
      return true; // Retorna true para permitir verificação
    }
    return mockAuth.isAuthenticated();
  },

  // Obter usuário atual (síncrono)
  getCurrentUser() {
    if (isSupabaseConfigured()) {
      return null; // Supabase não tem método síncrono
    }
    return mockAuth.getCurrentUser();
  },

  // Atualizar perfil
  async updateProfile(updates) {
    if (isSupabaseConfigured()) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado');

        const { data, error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

        if (error) throw error;

        return data;
      } catch (error) {
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    return await mockAuth.updateProfile(updates);
  },

  // Reset password
  async resetPassword(email) {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });

        if (error) throw error;

        return { message: 'Email de recuperação enviado' };
      } catch (error) {
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    return await mockAuth.resetPassword(email);
  },

  // Change password
  async changePassword(oldPassword, newPassword) {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (error) throw error;

        return { message: 'Senha alterada com sucesso' };
      } catch (error) {
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    return await mockAuth.changePassword(oldPassword, newPassword);
  },

  // List - Listar usuários (para admin)
  // Antes cortava em 1000 linhas sem avisar (o Supabase devolve no maximo
  // 1000 por requisicao). Agora pagina como as outras entidades (M3).
  // options.columns traz so as colunas pedidas.
  async list(options = {}) {
    if (isSupabaseConfigured()) {
      return await usersTabela.list(options);
    }

    // Fallback para Mock
    return await mockAuth.list ? await mockAuth.list(options) : [];
  },

  // Filter - Filtrar usuários (sintaxe simplificada)
  async filter(filters = {}, sort = null, limit = null) {
    const options = { filters };

    if (sort) options.sort = sort;
    if (limit) options.limit = limit;

    return await this.list(options);
  },

  // Update - Atualizar usuário (para admin)
  async update(userId, updates) {
    if (isSupabaseConfigured()) {
      return await usersTabela.update(userId, updates);
    }

    // Fallback para Mock
    if (mockAuth.update) {
      return await mockAuth.update(userId, updates);
    }
    throw new Error('Método não implementado');
  },

  // Get - Buscar usuário por ID
  async get(id, options = {}) {
    if (isSupabaseConfigured()) {
      return await usersTabela.get(id, options);
    }
    throw new Error('Método não implementado');
  },

  // Delete - Excluir usuário (para admin)
  async delete(userId) {
    if (isSupabaseConfigured()) {
      await usersTabela.delete(userId);
      return true;
    }

    // Fallback para Mock
    if (mockAuth.delete) {
      return await mockAuth.delete(userId);
    }
    throw new Error('Método não implementado');
  },
};
