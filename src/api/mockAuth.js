// Sistema de autenticação mockado com tela de login

import { mockUsers } from './mockData';

// Credenciais válidas para login
const validCredentials = [
  { email: 'admin@polowear.com', password: 'admin123' },
  { email: 'fornecedor@exemplo.com', password: 'fornecedor123' },
  { email: 'cliente@exemplo.com', password: 'cliente123' },
];

// Usuário atual (armazenado em memória e localStorage)
let currentUser = null;

// Carregar usuário do localStorage ao iniciar
const loadUserFromStorage = () => {
  if (typeof window !== 'undefined') {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
      } catch (_error) {
        localStorage.removeItem('currentUser');
      }
    }
  }
};

// Salvar usuário no localStorage
const saveUserToStorage = (user) => {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }
};

// Inicializar
loadUserFromStorage();

// Simula delay de rede
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAuth = {
  // Login - valida credenciais
  async login(email, password) {
    await delay();

    // Busca credenciais válidas
    const credential = validCredentials.find(c => c.email === email);

    if (!credential) {
      throw new Error('Email não encontrado');
    }

    if (credential.password !== password) {
      throw new Error('Senha incorreta');
    }

    // Busca o usuário completo em mockUsers
    const user = mockUsers.find(u => u.email === email);

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    currentUser = user;
    saveUserToStorage(user);


    return user;
  },

  // Logout
  async logout() {
    await delay();


    currentUser = null;
    saveUserToStorage(null);

    return true;
  },

  // Signup - cria novo usuário
  async signup(userData) {
    await delay();

    // Verifica se email já existe
    const existingUser = mockUsers.find(u => u.email === userData.email);
    if (existingUser) {
      throw new Error('Email já cadastrado');
    }

    // Cria novo usuário
    const newUser = {
      id: `user-${Date.now()}`,
      ...userData,
      role: 'user',
      createdAt: new Date(),
    };

    mockUsers.push(newUser);
    currentUser = newUser;
    saveUserToStorage(newUser);


    return newUser;
  },

  // Obter usuário atual
  async me() {
    await delay();

    if (!currentUser) {
      throw new Error('Não autenticado');
    }

    return currentUser;
  },

  // Verificar se está autenticado
  isAuthenticated() {
    return currentUser !== null;
  },

  // Obter usuário atual (síncrono)
  getCurrentUser() {
    return currentUser;
  },

  // Atualizar perfil
  async updateProfile(updates) {
    await delay();

    if (!currentUser) {
      throw new Error('Não autenticado');
    }

    // Atualiza o usuário atual
    currentUser = {
      ...currentUser,
      ...updates,
      updatedAt: new Date(),
    };

    // Atualiza no array de usuários
    const index = mockUsers.findIndex(u => u.id === currentUser.id);
    if (index !== -1) {
      mockUsers[index] = currentUser;
    }

    saveUserToStorage(currentUser);


    return currentUser;
  },

  // Reset password (mock)
  async resetPassword(email) {
    await delay();

    const user = mockUsers.find(u => u.email === email);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    return { message: 'Email de recuperação enviado' };
  },

  // Change password (mock)
  async changePassword(oldPassword, newPassword) {
    await delay();

    if (!currentUser) {
      throw new Error('Não autenticado');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Nova senha deve ter pelo menos 6 caracteres');
    }

    return { message: 'Senha alterada com sucesso' };
  },
};

// Exportar também o usuário mockado diretamente
export const getMockUser = () => currentUser;

// Log para debug
if (currentUser) {
} else {
}
