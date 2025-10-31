# 🔐 Credenciais de Login

## Sistema de Autenticação

O sistema agora possui uma **tela de login funcional** com validação de credenciais.

## 🌐 Acesso

**URL**: `http://localhost:5177/Login`

## 👥 Credenciais Disponíveis

### 1. **Admin** (Acesso Total)
```
Email: admin@polowear.com
Senha: admin123
```
- Acesso completo ao sistema
- Pode gerenciar usuários, produtos, pedidos, fornecedores, etc.
- Visualiza todas as áreas: Admin, Fornecedor e Cliente

### 2. **Fornecedor** (Visão de Fornecedor)
```
Email: fornecedor@exemplo.com
Senha: fornecedor123
```
- Acesso à área de fornecedor
- Gerenciar produtos próprios
- Visualizar e gerenciar pedidos recebidos
- Recursos e relatórios

### 3. **Cliente Multimarca** (Visão de Cliente)
```
Email: cliente@exemplo.com
Senha: cliente123
```
- Acesso à área de cliente
- Navegar catálogo
- Fazer pedidos
- Acompanhar pedidos
- Carrinho de compras

## 🚀 Como Usar

### Opção 1: Login Manual
1. Acesse `http://localhost:5177/Login`
2. Digite o email e senha
3. Clique em "Entrar"

### Opção 2: Botões de Login Rápido
Na tela de login há 3 botões para login rápido:
- **Login como Admin** - Um clique para entrar como admin
- **Login como Fornecedor** - Um clique para entrar como fornecedor
- **Login como Cliente** - Um clique para entrar como cliente

## 🔄 Fluxo de Autenticação

1. **Sem Login**: Ao tentar acessar qualquer página protegida, você será redirecionado para `/Login`
2. **Após Login**: Redirecionado automaticamente para `/PortalDashboard`
3. **Logout**: Clique no botão de logout no menu lateral → Volta para `/Login`
4. **Persistência**: O login é mantido no `localStorage`, então você permanece logado mesmo após recarregar a página

## 🛡️ Páginas Protegidas

As seguintes páginas requerem login:
- PortalDashboard
- UserManagement
- Catalogo
- MeusPedidos
- PedidosAdmin
- Admin
- GestaoProdutos
- GestaoFornecedores
- CrmDashboard
- GestaoClientes
- GestaoCapsulas
- GestaoEstoque
- Carrinho
- PedidosFornecedor
- CarteiraFinanceira
- HistoricoCompras
- DashboardAdmin
- GestaoMetas
- Recursos
- MeuPerfil

## 📝 Páginas Públicas

As seguintes páginas não requerem login:
- Home (página inicial)
- Login

## ⚙️ Validações

- ✅ Email deve estar cadastrado no sistema
- ✅ Senha deve corresponder ao usuário
- ✅ Mensagens de erro claras:
  - "Email não encontrado" - Quando o email não existe
  - "Senha incorreta" - Quando a senha está errada

## 🔧 Desenvolvimento

### Adicionar Novos Usuários

Edite `src/api/mockAuth.js` e adicione na array `validCredentials`:

```javascript
const validCredentials = [
  { email: 'novo@email.com', password: 'senha123' },
  // ...existentes
];
```

E adicione o usuário completo em `src/api/mockData.js` na array `mockUsers`.

### Alterar Redirecionamento Após Login

No arquivo `src/pages/Login.jsx`, linha ~24:

```javascript
navigate('/PortalDashboard'); // Altere para a rota desejada
```

## 📱 Interface da Tela de Login

A tela de login possui:
- ✅ Formulário com email e senha
- ✅ Validação de campos obrigatórios
- ✅ Indicador de carregamento durante login
- ✅ Mensagens de erro em caso de falha
- ✅ 3 botões de login rápido
- ✅ Design responsivo (funciona em mobile)
- ✅ Ícones e animações

## 🎨 Customização

### Alterar Logo/Ícone

Edite `src/pages/Login.jsx`, linhas 49-54 para trocar o ícone ou adicionar logo.

### Alterar Cores

O design usa as cores do tema do shadcn/ui. Para personalizar, edite o `tailwind.config.js`.

## 📊 Status do Sistema

🟢 **Servidor**: `http://localhost:5177/`
🟢 **Login**: Funcionando
🟢 **Logout**: Funcionando
🟢 **Redirecionamento**: Funcionando
🟢 **Persistência**: Funcionando (localStorage)

## 🐛 Troubleshooting

### Problema: "Erro ao fazer login"
- Verifique se digitou o email e senha corretamente
- Certifique-se de que o usuário existe em `mockUsers`

### Problema: Não redireciona após login
- Verifique o console do navegador por erros
- Certifique-se de que está usando uma das credenciais válidas

### Problema: Não persiste o login
- Verifique se o localStorage do navegador está habilitado
- Limpe o cache e tente novamente

### Problema: Loop de redirecionamento
- Limpe o localStorage: `localStorage.clear()` no console do navegador
- Recarregue a página

## 📖 Arquivos Modificados

1. `src/api/mockAuth.js` - Sistema de autenticação com validação
2. `src/pages/Login.jsx` - Nova página de login
3. `src/pages/index.jsx` - Adicionada rota `/Login`
4. `src/pages/Layout.jsx` - Adicionado redirecionamento se não autenticado

## ✨ Próximas Melhorias (Opcional)

- [ ] Adicionar "Lembrar-me" checkbox
- [ ] Implementar "Esqueci minha senha"
- [ ] Adicionar captcha
- [ ] Adicionar autenticação 2FA
- [ ] Adicionar registro de novos usuários
- [ ] Adicionar tema escuro na tela de login
