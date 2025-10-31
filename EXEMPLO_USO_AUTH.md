# Como Usar a Autenticação Simplificada

## Sistema de Autenticação Mockado

A autenticação foi simplificada para sempre retornar um **usuário admin autenticado automaticamente**.

## Usuário Mockado Padrão

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

## Exemplos de Uso

### 1. Obter o Usuário Atual

```javascript
import { User } from '@/api/entities';

// Método assíncrono
const user = await User.me();
console.log(user);
// Retorna sempre o usuário admin mockado

// Método síncrono
const currentUser = User.getCurrentUser();
console.log(currentUser);
// Retorna sempre o usuário admin mockado
```

### 2. Verificar se Está Autenticado

```javascript
import { User } from '@/api/entities';

const isAuth = User.isAuthenticated();
console.log(isAuth); // Sempre true
```

### 3. "Login" (Opcional - sempre retorna o mesmo usuário)

```javascript
import { User } from '@/api/entities';

// Aceita qualquer email/senha, sempre retorna o usuário admin
const user = await User.login('qualquer@email.com', 'qualquer-senha');
console.log(user);
// Retorna sempre o usuário admin mockado
```

### 4. "Logout" (Apenas Simula)

```javascript
import { User } from '@/api/entities';

await User.logout();
// Não faz nada, usuário continua "autenticado"
```

### 5. Atualizar Perfil (Simula mas não persiste)

```javascript
import { User } from '@/api/entities';

const updatedUser = await User.updateProfile({
  name: 'Novo Nome',
  telefone: '(11) 88888-8888',
});

console.log(updatedUser);
// Retorna dados atualizados temporariamente
// Mas o próximo User.me() volta ao original
```

### 6. Importar Usuário Diretamente

```javascript
import { getMockUser } from '@/api/mockAuth';

const user = getMockUser();
console.log(user);
// Retorna o usuário mockado diretamente (síncrono)
```

## Em Componentes React

### Exemplo em um Componente

```javascript
import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';

function MeuComponente() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await User.me();
      setUser(currentUser);
    };

    loadUser();
  }, []);

  if (!user) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      <h1>Bem-vindo, {user.name}!</h1>
      <p>Email: {user.email}</p>
      <p>Tipo: {user.tipo_negocio}</p>
    </div>
  );
}

export default MeuComponente;
```

### Exemplo no Layout

O arquivo `src/pages/Layout.jsx` já usa assim:

```javascript
const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
  const checkUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      setCurrentUser(null);
    }
  };
  checkUser();
}, [location.pathname]);
```

Como a autenticação agora sempre retorna um usuário, o `catch` nunca será executado.

## Características

✅ **Sempre Autenticado**: O sistema sempre retorna que há um usuário logado
✅ **Sem Login Real**: Não é necessário fazer login, o usuário já está "autenticado"
✅ **Sem Persistência**: Não usa localStorage, sempre retorna o mesmo objeto
✅ **Admin por Padrão**: O usuário mockado tem role 'admin' com acesso total
✅ **Compatível**: Mantém a mesma interface do sistema anterior

## Mudanças em Relação à Versão Anterior

| Antes | Agora |
|-------|-------|
| Precisava fazer login | Usuário já está logado |
| Usava localStorage | Não usa mais localStorage |
| Podia deslogar | Logout não faz nada |
| Diferentes usuários | Sempre o mesmo usuário admin |

## Alterando o Usuário Mockado

Para usar outro usuário (fornecedor, cliente), edite o arquivo `src/api/mockAuth.js`:

```javascript
// Para usar um fornecedor:
const mockCurrentUser = {
  id: 'user-fornecedor-1',
  email: 'fornecedor@exemplo.com',
  name: 'Fornecedor Teste',
  role: 'user',
  tipo_negocio: 'fornecedor',
  // ...
};

// Para usar um cliente:
const mockCurrentUser = {
  id: 'user-multimarca-1',
  email: 'cliente@exemplo.com',
  name: 'Cliente Multimarca',
  role: 'user',
  tipo_negocio: 'multimarca',
  // ...
};
```

## Debug

O sistema imprime logs no console:

```
MockAuth: Usuário admin sempre autenticado {id: 'user-admin-1', ...}
Login mockado - sempre retorna usuário admin: qualquer@email.com
Logout mockado - usuário continua autenticado
```

Esses logs ajudam a entender o que está acontecendo durante o desenvolvimento.
