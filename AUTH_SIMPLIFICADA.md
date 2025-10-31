# Autenticação Simplificada ✅

## Mudança Implementada

A autenticação foi **SIMPLIFICADA** para sempre retornar um usuário admin mockado automaticamente, sem necessidade de login.

## Usuário Mockado Padrão

**Sempre retorna este usuário:**

```javascript
{
  id: 'user-admin-1',
  email: 'admin@polowear.com',
  name: 'Admin Usuario',
  role: 'admin',
  tipo_negocio: 'admin',
  telefone: '(11) 99999-9999',
  avatar: 'https://via.placeholder.com/150/0066CC/FFFFFF?text=Admin',
  createdAt: new Date('2024-01-01'),
}
```

## Como Obter o Usuário

### Método 1: Assíncrono (Recomendado)

```javascript
import { User } from '@/api/entities';

const user = await User.me();
console.log(user);
```

### Método 2: Síncrono

```javascript
import { User } from '@/api/entities';

const user = User.getCurrentUser();
console.log(user);
```

### Método 3: Importação Direta

```javascript
import { getMockUser } from '@/api/mockAuth';

const user = getMockUser();
console.log(user);
```

## Exemplo Prático em Componente React

```javascript
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';

function MeuComponente() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Obter usuário mockado
    const loadUser = async () => {
      const currentUser = await User.me();
      setUser(currentUser);
    };

    loadUser();
  }, []);

  return (
    <div>
      <h1>Olá, {user?.name || 'Carregando...'}</h1>
      <p>Email: {user?.email}</p>
      <p>Tipo: {user?.tipo_negocio}</p>
    </div>
  );
}
```

## Características

✅ **Sempre autenticado** - Não precisa fazer login
✅ **Usuário admin** - Acesso total ao sistema
✅ **Sem localStorage** - Não salva nada localmente
✅ **Sem senha** - Não precisa validar credenciais
✅ **Compatível** - Mesma interface do sistema anterior

## Funções Disponíveis

Todas as funções continuam funcionando, mas agora são simplificadas:

| Função | Comportamento |
|--------|---------------|
| `User.me()` | Retorna o usuário admin mockado |
| `User.getCurrentUser()` | Retorna o usuário admin mockado (síncrono) |
| `User.isAuthenticated()` | Sempre retorna `true` |
| `User.login(email, password)` | Ignora credenciais e retorna o usuário admin |
| `User.logout()` | Não faz nada, usuário continua autenticado |
| `User.updateProfile(data)` | Simula atualização mas não persiste |

## Mudando o Usuário Mockado

Para usar outro tipo de usuário (fornecedor ou cliente), edite `src/api/mockAuth.js`:

### Para Fornecedor:

```javascript
const mockCurrentUser = {
  id: 'user-fornecedor-1',
  email: 'fornecedor@exemplo.com',
  name: 'Fornecedor Teste',
  role: 'user',
  tipo_negocio: 'fornecedor',
  telefone: '(11) 98765-4321',
  createdAt: new Date('2024-01-15'),
};
```

### Para Cliente Multimarca:

```javascript
const mockCurrentUser = {
  id: 'user-multimarca-1',
  email: 'cliente@exemplo.com',
  name: 'Cliente Multimarca',
  role: 'user',
  tipo_negocio: 'multimarca',
  telefone: '(11) 91234-5678',
  createdAt: new Date('2024-02-01'),
};
```

## Logs no Console

O sistema imprime logs para debug:

```
MockAuth: Usuário admin sempre autenticado {id: 'user-admin-1', ...}
```

Quando você faz login/logout também aparece:

```
Login mockado - sempre retorna usuário admin: teste@email.com
Logout mockado - usuário continua autenticado
```

## Arquivo Modificado

- ✅ `src/api/mockAuth.js` - Sistema de autenticação simplificado

## Documentação Adicional

Veja mais exemplos em: `EXEMPLO_USO_AUTH.md`

## Status do Servidor

🟢 **Servidor rodando**: `http://localhost:5177/`
🟢 **Sem erros**
🟢 **Usuário sempre disponível**
