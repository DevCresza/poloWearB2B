# Usuários de Teste - Polo Wear B2B

## Data: 30/10/2025

---

## 🔐 Usuários Criados no Supabase

### 1. **Administrador** ✅

```
Email: admin@polo-b2b.com
Senha: admin123
Role: admin
Tipo: admin
```

**Permissões**: Acesso completo ao sistema

---

### 2. **Fornecedor MX** ✅

```
Email: fornecedor@exemplo.com
Senha: fornecedor123
Role: fornecedor
Tipo: fornecedor
```

**Dados da Empresa**:
- Nome: João Silva Fornecedor
- Empresa: MX Confecções
- Marca: MX
- CNPJ: 11.222.333/0001-44
- Telefone: (11) 98765-4321

**Produtos**: 2 produtos cadastrados (Camiseta Básica MX, Calça Jeans MX Slim)

---

### 3. **Cliente Multimarca SP** ✅

```
Email: cliente@exemplo.com
Senha: cliente123
Role: multimarca
Tipo: multimarca
```

**Dados da Empresa**:
- Nome: Maria Santos Cliente
- Empresa: Loja Multimarca ABC
- Razão Social: ABC COMERCIO DE ROUPAS LTDA
- CNPJ: 98.765.432/0001-10
- Telefone: (11) 91234-5678
- Cidade: São Paulo - SP
- Endereço: Rua das Flores, 123 - Centro
- CEP: 01234-567
- Loja Física: Sim
- Faixa Faturamento: R$ 50.000 - R$ 100.000
- Limite Crédito: R$ 10.000,00

---

### 4. **Cliente Multimarca RJ** ✅

```
Email: cliente2@exemplo.com
Senha: cliente123
Role: multimarca
Tipo: multimarca
```

**Dados da Empresa**:
- Nome: Carlos Oliveira
- Empresa: Boutique Fashion Rio
- Razão Social: FASHION RIO COMERCIO LTDA
- CNPJ: 12.345.678/0001-99
- Telefone: (21) 98888-7777
- Cidade: Rio de Janeiro - RJ
- Loja Física: Sim
- Faixa Faturamento: R$ 100.000 - R$ 500.000
- Limite Crédito: R$ 25.000,00

---

## 🏢 Fornecedores Cadastrados

### 1. **Polo Wear** ✅
- Razão Social: POLO WEAR COMERCIO DE ROUPAS LTDA
- CNPJ: 12.345.678/0001-90
- Pedido Mínimo: R$ 500,00
- Produtos: 3 produtos

### 2. **MX** ✅
- Razão Social: MX CONFECCOES LTDA
- CNPJ: 11.222.333/0001-44
- Pedido Mínimo: R$ 300,00
- Produtos: 2 produtos
- Responsável: João Silva (fornecedor@exemplo.com)

### 3. **Guirro** ✅
- Razão Social: GUIRRO MODA MASCULINA LTDA
- CNPJ: 22.333.444/0001-55
- Pedido Mínimo: R$ 800,00
- Produtos: 1 produto

### 4. **MGM** ✅
- Razão Social: MGM FASHION LTDA
- CNPJ: 33.444.555/0001-66
- Pedido Mínimo: R$ 600,00
- Produtos: 0 produtos (pode adicionar)

---

## 📦 Produtos Cadastrados (6 produtos)

### Polo Wear (3 produtos):

1. **Camisa Polo Azul Marinho** ⭐
   - Preço: R$ 89,90
   - Estoque: 25 grades
   - Categoria: Camisas
   - Destaque: Sim

2. **Camisa Polo Branca** ⭐
   - Preço: R$ 89,90
   - Estoque: 18 grades
   - Categoria: Camisas
   - Destaque: Sim

3. **Bermuda Jeans Masculina**
   - Preço: R$ 129,90
   - Estoque: 15 grades
   - Categoria: Bermudas
   - Destaque: Não

### MX (2 produtos):

4. **Camiseta Básica MX** ⭐
   - Preço: R$ 45,90
   - Estoque: 30 grades
   - Categoria: Camisas
   - Destaque: Sim

5. **Calça Jeans MX Slim**
   - Preço: R$ 159,90
   - Estoque: 12 grades
   - Categoria: Calças
   - Destaque: Não

### Guirro (1 produto):

6. **Camisa Social Guirro Slim** ⭐
   - Preço: R$ 189,90
   - Estoque: 8 grades
   - Categoria: Camisas
   - Destaque: Sim

---

## 🧪 Cenários de Teste

### Teste 1: Login como Admin
```
1. Acesse o sistema
2. Login: admin@polo-b2b.com / admin123
3. Verifique acesso a todas as funcionalidades
4. Visualize todos os usuários, fornecedores e produtos
```

### Teste 2: Login como Fornecedor
```
1. Login: fornecedor@exemplo.com / fornecedor123
2. Acesse Gestão de Produtos
3. Verifique que vê apenas produtos da marca MX
4. Tente criar um novo produto MX
5. Acesse Pedidos do Fornecedor
```

### Teste 3: Login como Cliente
```
1. Login: cliente@exemplo.com / cliente123
2. Acesse o Catálogo
3. Veja todos os 6 produtos disponíveis
4. Adicione produtos ao carrinho
5. Finalize um pedido
6. Acesse Meus Pedidos para visualizar
```

### Teste 4: Fluxo Completo de Pedido
```
1. Login como cliente (cliente@exemplo.com)
2. Navegue no catálogo
3. Adicione 2 grades da "Camisa Polo Azul Marinho"
4. Adicione 1 grade da "Camiseta Básica MX"
5. Vá ao carrinho
6. Finalize o pedido
7. Logout
8. Login como admin
9. Visualize o pedido em Pedidos Admin
10. Atualize o status do pedido
```

---

## 📊 Resumo dos Dados

| Tipo | Quantidade |
|------|------------|
| **Usuários** | 4 |
| - Admins | 1 |
| - Fornecedores | 1 |
| - Clientes | 2 |
| **Fornecedores** | 4 |
| **Produtos** | 6 |
| - Polo Wear | 3 |
| - MX | 2 |
| - Guirro | 1 |
| - MGM | 0 |

---

## 🔄 Senha Padrão

**Todas as senhas de teste são**:
- Admin: `admin123`
- Fornecedor: `fornecedor123`
- Clientes: `cliente123`

⚠️ **IMPORTANTE**: Estas são senhas de TESTE apenas. Em produção, use senhas fortes e únicas!

---

## 🚀 Como Testar

### 1. Inicie o projeto:
```bash
cd "C:\Users\patri\Desktop\Roberto\Polowear 2\polo-wear-multimarcas-copy-5229f1e6 (3)"
npm run dev
```

### 2. Acesse no navegador:
```
http://localhost:5173
```

### 3. Faça login com qualquer usuário acima

### 4. Explore as funcionalidades conforme o role do usuário

---

## 📝 Notas Importantes

1. **Autenticação Supabase**: O sistema está usando Supabase Auth em conjunto com a tabela `users`

2. **Estoque Controlado**: Todos os produtos têm controle de estoque ativado

3. **Pedido Mínimo**: Cada fornecedor tem um valor mínimo de pedido:
   - Polo Wear: R$ 500,00
   - MX: R$ 300,00
   - Guirro: R$ 800,00
   - MGM: R$ 600,00

4. **Sistema de Grades**: Produtos são vendidos por grade completa (conjunto de tamanhos)

5. **Produtos em Destaque**: 4 dos 6 produtos estão marcados como destaque (⭐)

---

## 🔧 Troubleshooting

### Login não funciona?
- Verifique se o arquivo `.env` existe com as credenciais corretas
- Reinicie o servidor de desenvolvimento
- Verifique se o usuário existe no Supabase

### Produtos não aparecem?
- Faça login como admin e verifique em Gestão de Produtos
- Verifique no Supabase Dashboard se os produtos foram inseridos
- Certifique-se que os produtos estão ativos (`ativo = true`)

### Erro "Not authenticated"?
- Limpe o localStorage do navegador
- Faça logout e login novamente
- Verifique se a sessão do Supabase está ativa

---

**Status**: ✅ Todos os usuários e dados de teste criados com sucesso!

**Último Update**: 30/10/2025
