# Scripts de Teste - Polo Wear Multimarcas

## 🧪 Suite de Testes Automatizados

Scripts de teste completos para validar todas as funcionalidades do sistema com Supabase.

---

## 🚀 Como Usar

### 1. Executar TODOS os Testes

```bash
node scripts/testes/run-all-tests.js
```

### 2. Executar Teste Específico

```bash
# Testes Admin (30 testes)
node scripts/testes/test-admin.js

# Testes Fornecedor (20 testes)
node scripts/testes/test-fornecedor.js

# Testes Cliente (40+ testes)
node scripts/testes/test-cliente.js
```

---

## 📊 Resultados

### ✅ Admin - 100% Passando

```
📊 Total de Testes: 30
✅ Testes Passaram: 30
❌ Testes Falharam: 0
📈 Taxa de Sucesso: 100.00%
```

**Funcionalidades:**
- Autenticação ✅
- Gestão de Usuários ✅
- Gestão de Produtos ✅
- Gestão de Fornecedores ✅
- Gestão de Pedidos ✅
- CRM/Contatos ✅
- Carteira Financeira ✅
- Metas de Vendas ✅

### ⚠️ Fornecedor - 25% Passando

```
📊 Total de Testes: 20
✅ Testes Passaram: 5
❌ Testes Falharam: 15
📈 Taxa de Sucesso: 25.00%
```

**Problema:** Usuário fornecedor precisa de associação com tabela `fornecedores`.

### 📝 Cliente - Não Executado

Scripts criados, aguardando execução.

---

## 📁 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `test-admin.js` | Testes nível Admin |
| `test-fornecedor.js` | Testes nível Fornecedor |
| `test-cliente.js` | Testes nível Cliente |
| `run-all-tests.js` | Executa todos os testes |
| `relatorio-*.json` | Relatórios gerados |

---

## 🔧 Pré-requisitos

1. **.env configurado** com credenciais Supabase
2. **Usuários de teste** criados no Supabase:
   - `admin@polo-b2b.com` / `admin123`
   - `fornecedor@exemplo.com` / `fornecedor123`
   - `cliente@exemplo.com` / `cliente123`

---

## 📖 Documentação Completa

Veja `TESTES-SUPABASE.md` para documentação detalhada.

---

**Data:** 30/10/2025
**Projeto:** Polo Wear Multimarcas B2B
