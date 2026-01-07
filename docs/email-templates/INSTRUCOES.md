# Templates de Email - Supabase Auth

## Como Configurar

### 1. Acesse o Dashboard do Supabase
- Va para: https://supabase.com/dashboard
- Selecione o projeto: **Polowear2**

### 2. Configure os Email Templates
- No menu lateral, va para: **Authentication** > **Email Templates**

### 3. Configure cada template:

---

#### Reset Password (Recuperar Senha)
1. Clique em **Reset Password**
2. No campo **Subject**, coloque:
   ```
   Recuperar Senha - POLO B2B
   ```
3. No campo **Message**, cole o conteudo do arquivo `reset-password.html`
4. Clique em **Save**

---

#### Confirm Signup (Confirmar Cadastro)
1. Clique em **Confirm Signup**
2. No campo **Subject**, coloque:
   ```
   Confirme seu email - POLO B2B
   ```
3. No campo **Message**, cole o conteudo do arquivo `confirm-signup.html`
4. Clique em **Save**

---

### 4. Configure as URLs

Va para **Authentication** > **URL Configuration** e configure:

- **Site URL**: `https://seu-dominio.com` (URL da aplicacao em producao)
- **Redirect URLs**: Adicione as URLs permitidas para redirecionamento:
  - `https://seu-dominio.com/*`
  - `http://localhost:5173/*` (para desenvolvimento)

---

## Variaveis Disponiveis nos Templates

O Supabase substitui automaticamente estas variaveis:

| Variavel | Descricao |
|----------|-----------|
| `{{ .ConfirmationURL }}` | Link para confirmar a acao (reset, confirm, etc) |
| `{{ .Email }}` | Email do usuario |
| `{{ .Token }}` | Token de confirmacao |
| `{{ .TokenHash }}` | Hash do token |
| `{{ .SiteURL }}` | URL do site configurado |

---

## Testando

1. Acesse a pagina de login da aplicacao
2. Clique em "Esqueci minha senha"
3. Digite um email valido
4. Verifique a caixa de entrada (e spam) do email

---

## Dicas

- Os emails podem demorar alguns segundos para chegar
- Verifique a pasta de spam se nao receber
- O Supabase tem limite de emails no plano gratuito (4 emails/hora)
- Para producao, considere configurar um SMTP customizado em **Project Settings** > **Auth** > **SMTP Settings**
