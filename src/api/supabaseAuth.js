// Autenticação com Supabase
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mockAuth } from './mockAuth';

// Se Supabase não configurado, usa mock
if (!isSupabaseConfigured()) {
  console.warn('⚠️ Supabase não configurado. Usando Mock Auth.');
}

export const supabaseAuth = {
  // Login
  async login(email, password) {
    // Se Supabase configurado, usa Supabase
    if (isSupabaseConfigured()) {
      try {
        console.log('🔐 Tentando login com Supabase:', email);

        // Login com Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          console.error('❌ Erro Supabase Auth:', authError);
          throw authError;
        }

        console.log('✅ Supabase Auth sucesso, buscando dados do usuário...');

        // Buscar dados completos do usuário na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (userError) {
          console.error('❌ Erro ao buscar usuário:', userError);
          throw userError;
        }

        console.log('✅ Login Supabase completo:', userData.email);

        // Atualizar last_login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id);

        return userData;
      } catch (error) {
        console.error('❌ Erro no login Supabase:', error);
        throw new Error(error.message || 'Erro ao fazer login');
      }
    }

    // Fallback para Mock
    console.log('🔐 Usando Mock Auth (Supabase não configurado)');
    return await mockAuth.login(email, password);
  },

  // Logout
  async logout() {
    if (isSupabaseConfigured()) {
      try {
        console.log('👋 Logout Supabase');
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return true;
      } catch (error) {
        console.error('❌ Erro no logout Supabase:', error);
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    console.log('👋 Logout Mock');
    return await mockAuth.logout();
  },

  // Me - Verificar usuário autenticado
  async me() {
    if (isSupabaseConfigured()) {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error('Não autenticado');
        }

        // Buscar dados completos na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) {
          throw userError;
        }

        console.log('✅ Usuário autenticado (Supabase):', userData.email);
        return userData;
      } catch (error) {
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
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([{
            id: authData.user.id,
            email,
            ...otherData,
          }])
          .select()
          .single();

        if (createError) throw createError;

        console.log('✅ Signup Supabase completo:', newUser.email);
        return newUser;
      } catch (error) {
        console.error('❌ Erro no signup Supabase:', error);
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    console.log('📝 Usando Mock Signup');
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

        console.log('✅ Perfil atualizado (Supabase)');
        return data;
      } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
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

        console.log('✅ Email de reset enviado (Supabase)');
        return { message: 'Email de recuperação enviado' };
      } catch (error) {
        console.error('❌ Erro no reset password:', error);
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

        console.log('✅ Senha alterada (Supabase)');
        return { message: 'Senha alterada com sucesso' };
      } catch (error) {
        console.error('❌ Erro ao alterar senha:', error);
        throw new Error(error.message);
      }
    }

    // Fallback para Mock
    return await mockAuth.changePassword(oldPassword, newPassword);
  },

  // List - Listar usuários (para admin)
  async list(options = {}) {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('users').select('*');

        // Aplicar filtros
        if (options.filters) {
          Object.entries(options.filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        // Aplicar ordenação
        if (options.sort) {
          const isDesc = options.sort.startsWith('-');
          const field = isDesc ? options.sort.substring(1) : options.sort;
          query = query.order(field, { ascending: !isDesc });
        }

        // Aplicar limite
        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log(`✅ Listados ${data.length} usuários (Supabase)`);
        return data;
      } catch (error) {
        console.error('❌ Erro ao listar usuários:', error);
        throw new Error(error.message);
      }
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
};
