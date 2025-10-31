// Authentication Service - Camada de abstração para autenticação
// Usa Supabase quando configurado, fallback para mockAuth

import { supabase, handleSupabaseError, handleSupabaseSuccess, isSupabaseConfigured } from '@/lib/supabase';
import { mockAuth } from '@/api/mockAuth';
import { User } from '@/api/entities';

/**
 * AuthService fornece métodos de autenticação e gerenciamento de usuário
 * com interface padronizada que retorna {success, data, error}
 */
class AuthService {
  constructor() {
    this.SESSION_KEY = 'auth_session';
    this.SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hora
  }

  /**
   * Login com email e senha
   * @param {string} email - Email do usuário
   * @param {string} password - Senha do usuário
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async login(email, password) {
    try {
      // Se Supabase está configurado, usa Supabase Auth
      if (isSupabaseConfigured()) {
        // Login com Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authError) throw authError;

        // Busca dados completos do usuário na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (userError) throw userError;

        // Atualiza last_login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id);

        // Salva sessão
        this.saveSession({
          user: userData,
          timestamp: Date.now()
        });

        console.log('AuthService: Login realizado com sucesso (Supabase)', userData.email);

        return this.handleSuccess({
          user: userData,
          session: authData.session
        });
      }

      // Fallback para mockAuth se Supabase não configurado
      const user = await mockAuth.login(email, password);

      this.saveSession({
        user,
        timestamp: Date.now()
      });

      console.log('AuthService: Login realizado com sucesso (Mock)', user.email);

      return this.handleSuccess({
        user,
        session: { accessToken: 'mock-token' }
      });
    } catch (error) {
      console.error('AuthService: Erro no login', error);
      return this.handleError(error);
    }
  }

  /**
   * Registro de novo usuário
   * @param {Object} userData - Dados do usuário
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async register(userData) {
    try {
      let user;

      try {
        // Tenta usar User.create() se disponível
        user = await User.create(userData);
      } catch (error) {
        // Fallback para mockAuth
        user = await mockAuth.signup(userData);
      }

      // Salva sessão
      this.saveSession({
        user,
        timestamp: Date.now()
      });

      console.log('AuthService: Registro realizado com sucesso', user.email);

      return this.handleSuccess({
        user,
        session: { accessToken: 'mock-token' }
      });
    } catch (error) {
      console.error('AuthService: Erro no registro', error);
      return this.handleError(error);
    }
  }

  /**
   * Recuperar dados do usuário atual
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async me() {
    try {
      // Se Supabase está configurado, usa Supabase Auth
      if (isSupabaseConfigured()) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error('Não autenticado');
        }

        // Busca dados completos na tabela users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        // Atualiza sessão
        this.saveSession({
          user: userData,
          timestamp: Date.now()
        });

        console.log('AuthService: Usuário recuperado (Supabase)', userData.email);

        return this.handleSuccess(userData);
      }

      // Fallback para mockAuth
      const session = this.getSession();

      if (!session) {
        throw new Error('Não autenticado - sem sessão');
      }

      // Verifica timeout da sessão
      const now = Date.now();
      if (now - session.timestamp > this.SESSION_TIMEOUT) {
        console.warn('AuthService: Sessão expirada');
        this.clearSession();
        throw new Error('Sessão expirada');
      }

      // Se tem sessão válida em cache, retorna
      if (session.user) {
        console.log('AuthService: Usuário recuperado do cache (Mock)', session.user.email);
        return this.handleSuccess(session.user);
      }

      // Busca do mockAuth
      const user = await mockAuth.me();

      this.saveSession({
        user,
        timestamp: now
      });

      console.log('AuthService: Usuário recuperado (Mock)', user.email);

      return this.handleSuccess(user);
    } catch (error) {
      console.error('AuthService: Erro ao recuperar usuário', error);
      this.clearSession();
      return this.handleError(error);
    }
  }

  /**
   * Logout
   * @returns {Promise<{success: boolean, data?: boolean, error?: string}>}
   */
  async logout() {
    try {
      // Se Supabase está configurado, usa Supabase Auth
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        this.clearSession();
        console.log('AuthService: Logout realizado com sucesso (Supabase)');

        return this.handleSuccess(true);
      }

      // Fallback para mockAuth
      await mockAuth.logout();
      this.clearSession();

      console.log('AuthService: Logout realizado com sucesso (Mock)');

      return this.handleSuccess(true);
    } catch (error) {
      console.error('AuthService: Erro no logout', error);
      return this.handleError(error);
    }
  }

  /**
   * Atualizar perfil do usuário
   * @param {string} userId - ID do usuário
   * @param {Object} updateData - Dados para atualizar
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async updateProfile(userId, updateData) {
    try {
      let updatedUser;

      // Se Supabase está configurado, usa Supabase
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        updatedUser = data;

        console.log('AuthService: Perfil atualizado (Supabase)', updatedUser.email);
      } else {
        // Fallback para mockAuth
        updatedUser = await mockAuth.updateProfile(updateData);
        console.log('AuthService: Perfil atualizado (Mock)', updatedUser.email);
      }

      // Atualiza sessão
      const session = this.getSession();
      if (session) {
        this.saveSession({
          user: updatedUser,
          timestamp: session.timestamp
        });
      }

      return this.handleSuccess(updatedUser);
    } catch (error) {
      console.error('AuthService: Erro ao atualizar perfil', error);
      return this.handleError(error);
    }
  }

  /**
   * Verificar se email já existe
   * @param {string} email - Email para verificar
   * @returns {Promise<{success: boolean, data?: boolean, error?: string}>}
   */
  async checkEmailExists(email) {
    try {
      const result = await User.list({ filters: { email } });
      const exists = result && result.length > 0;

      return this.handleSuccess(exists);
    } catch (error) {
      console.error('AuthService: Erro ao verificar email', error);
      return this.handleError(error);
    }
  }

  /**
   * Reset de senha
   * @param {string} email - Email do usuário
   * @returns {Promise<{success: boolean, data?: boolean, error?: string}>}
   */
  async resetPassword(email) {
    try {
      await mockAuth.resetPassword(email);

      console.log('AuthService: Reset de senha enviado para', email);

      return this.handleSuccess(true);
    } catch (error) {
      console.error('AuthService: Erro ao resetar senha', error);
      return this.handleError(error);
    }
  }

  /**
   * Atualizar senha
   * @param {string} oldPassword - Senha antiga
   * @param {string} newPassword - Senha nova
   * @returns {Promise<{success: boolean, data?: boolean, error?: string}>}
   */
  async updatePassword(oldPassword, newPassword) {
    try {
      await mockAuth.changePassword(oldPassword, newPassword);

      console.log('AuthService: Senha atualizada com sucesso');

      return this.handleSuccess(true);
    } catch (error) {
      console.error('AuthService: Erro ao atualizar senha', error);
      return this.handleError(error);
    }
  }

  /**
   * Verificar se o usuário está autenticado (síncrono)
   * @returns {boolean}
   */
  isAuthenticated() {
    const session = this.getSession();

    if (!session) return false;

    // Verifica timeout
    const now = Date.now();
    if (now - session.timestamp > this.SESSION_TIMEOUT) {
      this.clearSession();
      return false;
    }

    return true;
  }

  /**
   * Obter usuário atual da sessão (síncrono)
   * @returns {Object|null}
   */
  getCurrentUser() {
    const session = this.getSession();
    return session?.user || null;
  }

  /**
   * Salvar sessão no localStorage
   * @private
   */
  saveSession(session) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      } catch (error) {
        console.error('Erro ao salvar sessão:', error);
      }
    }
  }

  /**
   * Recuperar sessão do localStorage
   * @private
   */
  getSession() {
    if (typeof window !== 'undefined') {
      try {
        const data = localStorage.getItem(this.SESSION_KEY);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('Erro ao recuperar sessão:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Limpar sessão
   * @private
   */
  clearSession() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  /**
   * Helper para formatar resposta de sucesso
   * @private
   */
  handleSuccess(data) {
    return {
      success: true,
      data
    };
  }

  /**
   * Helper para formatar resposta de erro
   * @private
   */
  handleError(error) {
    return {
      success: false,
      error: error?.message || 'Erro desconhecido',
      details: error
    };
  }
}

// Exportar instância singleton
export const authService = new AuthService();
export default authService;
