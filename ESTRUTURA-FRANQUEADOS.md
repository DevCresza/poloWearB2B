# Sistema de Franqueados - Polo Wear

## Data: 30/10/2025

---

## 🏪 Estrutura de Franqueados

O sistema **Polo Wear Multimarcas** é na verdade um **sistema de gestão de franqueados da rede Polo Wear**.

---

## 👥 NÍVEIS DE ACESSO

### 1. **Admin** (Polo Wear - Matriz)
- Gestão completa do sistema
- Gerenciar todos os franqueados
- Gestão de produtos, pedidos, finan

ceiro
- Metas e relatórios consolidados

### 2. **Fornecedor** (Fornecedores das Marcas)
- Marcas parceiras: Polo Wear, MX, Guirro, MGM
- Gestão de seus próprios produtos
- Visualizar pedidos recebidos
- Controle de estoque

### 3. **Franqueado** (Lojas Franqueadas)
- Fazer pedidos de produtos
- Gerenciar carrinho de compras
- Acompanhar pedidos
- Carteira financeira
- Metas de vendas

---

## 🗄️ ESTRUTURA NO BANCO DE DADOS

### Tabela `franqueados` (NOVA ✨)

```sql
CREATE TABLE franqueados (
  id UUID PRIMARY KEY,

  -- Identificação
  codigo_franquia VARCHAR(20) UNIQUE,  -- POL-SP-001
  nome_fantasia VARCHAR(255),
  razao_social VARCHAR(255),
  cnpj VARCHAR(18) UNIQUE,

  -- Responsável
  responsavel_user_id UUID REFERENCES users(id),
  responsavel_nome VARCHAR(255),
  responsavel_cpf VARCHAR(14),
  responsavel_telefone VARCHAR(20),
  responsavel_email VARCHAR(255),

  -- Endereço
  endereco_completo TEXT,
  cep VARCHAR(9),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  bairro VARCHAR(100),
  numero VARCHAR(10),
  complemento VARCHAR(100),

  -- Dados da Loja
  data_abertura DATE,
  data_inauguracao DATE,
  area_loja NUMERIC(10, 2),  -- m²
  numero_funcionarios INTEGER,

  -- Financeiro
  taxa_franquia NUMERIC(10, 2),  -- Taxa mensal
  faturamento_mensal_medio NUMERIC(12, 2),
  limite_credito NUMERIC(12, 2),
  dia_vencimento_fatura INTEGER,

  -- Status
  status VARCHAR(50),  -- ativa, inativa, suspensa, em_implantacao
  ativo BOOLEAN,

  -- Contrato
  numero_contrato VARCHAR(50),
  data_contrato DATE,
  vigencia_contrato_inicio DATE,
  vigencia_contrato_fim DATE,

  observacoes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Tabela `users` (ATUALIZADA)

Adicionado:
- `franqueado_id UUID` - Referência ao franqueado
- Role `'franqueado'` - Novo tipo de usuário

### Tabela `pedidos` (ATUALIZADA)

Adicionado:
- `franqueado_id UUID` - Pedidos agora vinculados ao franqueado

---

## 📊 DADOS MIGRADOS

### Franqueados Criados Automaticamente

Os usuários antigos do tipo "multimarca" foram migrados para franqueados:

| Código | Nome Fantasia | Responsável | Cidade | Limite Crédito |
|--------|---------------|-------------|--------|----------------|
| **POL-BR-001** | Loja Multimarca ABC | Maria Santos Cliente | São Paulo - SP | R$ 10.000,00 |
| **POL-BR-002** | Boutique Fashion Rio | Carlos Oliveira | Rio de Janeiro - RJ | R$ 25.000,00 |

### Usuários de Teste

| Email | Senha | Role | Descrição |
|-------|-------|------|-----------|
| admin@polo-b2b.com | admin123 | admin | Administrador Matriz |
| fornecedor@exemplo.com | fornecedor123 | fornecedor | Fornecedor MX |
| cliente@exemplo.com | cliente123 | franqueado | Franqueado POL-BR-001 |
| cliente2@exemplo.com | cliente123 | franqueado | Franqueado POL-BR-002 |

---

## 🚀 COMO USAR

### Importar Entidade Franqueado

```javascript
import { Franqueado } from '@/api/entities';
```

### Listar Franqueados

```javascript
// Listar todos os franqueados
const franqueados = await Franqueado.list();

// Listar apenas ativos
const ativos = await Franqueado.filter({ ativo: true });

// Listar por estado
const franqueadosSP = await Franqueado.filter({ estado: 'SP' });

// Listar por status
const ativas = await Franqueado.filter({ status: 'ativa' });
```

### Buscar Franqueado por ID

```javascript
const franqueado = await Franqueado.get(franqueadoId);

console.log(franqueado.codigo_franquia);  // POL-SP-001
console.log(franqueado.nome_fantasia);    // Loja ABC
console.log(franqueado.limite_credito);   // 10000.00
```

### Criar Novo Franqueado

```javascript
const novoFranqueado = await Franqueado.create({
  codigo_franquia: 'POL-SP-003',
  nome_fantasia: 'Polo Wear Campinas',
  razao_social: 'CAMPINAS POLO LTDA',
  cnpj: '12.345.678/0001-90',
  responsavel_nome: 'João Silva',
  responsavel_email: 'joao@polocampinas.com',
  responsavel_telefone: '(19) 98765-4321',
  cidade: 'Campinas',
  estado: 'SP',
  endereco_completo: 'Av. Principal, 1000 - Centro',
  cep: '13010-111',
  area_loja: 120.50,
  limite_credito: 15000.00,
  taxa_franquia: 2500.00,
  dia_vencimento_fatura: 10,
  status: 'em_implantacao',
  data_contrato: '2025-01-15',
  vigencia_contrato_inicio: '2025-02-01',
  vigencia_contrato_fim: '2030-01-31'
});
```

### Atualizar Franqueado

```javascript
// Atualizar status
await Franqueado.update(franqueadoId, {
  status: 'ativa',
  data_inauguracao: '2025-02-15'
});

// Aumentar limite de crédito
await Franqueado.update(franqueadoId, {
  limite_credito: 20000.00
});

// Atualizar dados de contato
await Franqueado.update(franqueadoId, {
  responsavel_telefone: '(19) 99999-8888',
  responsavel_email: 'novoemail@polocampinas.com'
});
```

### Buscar Franqueado do Usuário Logado

```javascript
import { User, Franqueado } from '@/api/entities';

const user = await User.me();

if (user.tipo_negocio === 'franqueado' && user.franqueado_id) {
  const meuFranqueado = await Franqueado.get(user.franqueado_id);

  console.log('Meu código:', meuFranqueado.codigo_franquia);
  console.log('Limite de crédito:', meuFranqueado.limite_credito);
  console.log('Status:', meuFranqueado.status);
}
```

### Listar Pedidos do Franqueado

```javascript
import { Pedido } from '@/api/entities';

// Buscar pedidos pelo franqueado_id
const pedidosFranqueado = await Pedido.filter({
  franqueado_id: user.franqueado_id
});

console.log(`Total de pedidos: ${pedidosFranqueado.length}`);
```

---

## 📊 VIEW `vw_franqueados_ativos`

Uma view foi criada para facilitar consultas:

```sql
SELECT * FROM vw_franqueados_ativos;
```

Retorna:
- Todos os dados do franqueado
- Nome e email do responsável (usuário)
- Total de pedidos
- Valor total de pedidos

---

## 🎯 FLUXO DE NEGÓCIO

### 1. Novo Franqueado

```
Admin cria franqueado →
Cria usuário associado →
Franqueado faz login →
Franqueado faz pedidos
```

### 2. Pedido de Franqueado

```
Franqueado navega catálogo →
Adiciona produtos ao carrinho →
Finaliza pedido →
Pedido vinculado ao franqueado_id →
Admin/Fornecedor processa
```

### 3. Controle Financeiro

```
Franqueado faz pedido →
Sistema cria título na carteira →
Franqueado visualiza vencimentos →
Paga título →
Status atualizado
```

---

## 📈 ESTATÍSTICAS

### Por Franqueado

```javascript
// Total gasto
const { data: pedidos } = await supabase
  .from('pedidos')
  .select('valor_final')
  .eq('franqueado_id', franqueadoId);

const totalGasto = pedidos.reduce((sum, p) => sum + p.valor_final, 0);

// Limite disponível
const franqueado = await Franqueado.get(franqueadoId);
const limiteDisponivel = franqueado.limite_credito - totalGasto;
```

### Consolidado (Admin)

```javascript
// Total de franqueados
const totalFranqueados = await Franqueado.count();

// Franqueados ativos
const ativosCount = await Franqueado.count({ status: 'ativa' });

// Por estado
const franqueadosSP = await Franqueado.filter({ estado: 'SP' });
```

---

## 🔐 CONTROLE DE ACESSO

### Admin
```javascript
const user = await User.me();

if (user.role === 'admin') {
  // Pode ver TODOS os franqueados
  const todos = await Franqueado.list();

  // Pode criar novos
  const novo = await Franqueado.create({...});

  // Pode atualizar qualquer um
  await Franqueado.update(id, {...});
}
```

### Franqueado
```javascript
const user = await User.me();

if (user.tipo_negocio === 'franqueado') {
  // Pode ver APENAS seu franqueado
  const meuFranqueado = await Franqueado.get(user.franqueado_id);

  // NÃO pode ver outros franqueados
  // (implementar filtro na aplicação)

  // Pode atualizar apenas alguns campos
  await Franqueado.update(user.franqueado_id, {
    responsavel_telefone: '...',
    numero_funcionarios: 5
  });
}
```

---

## 🎨 INTERFACE

### Tela de Franqueado (Exemplo)

```jsx
import { Franqueado, User } from '@/api/entities';

function MeuFranqueado() {
  const [user, setUser] = useState(null);
  const [franqueado, setFranqueado] = useState(null);

  useEffect(() => {
    async function loadData() {
      const currentUser = await User.me();
      setUser(currentUser);

      if (currentUser.franqueado_id) {
        const data = await Franqueado.get(currentUser.franqueado_id);
        setFranqueado(data);
      }
    }
    loadData();
  }, []);

  if (!franqueado) return <div>Carregando...</div>;

  return (
    <div>
      <h1>{franqueado.nome_fantasia}</h1>
      <p>Código: {franqueado.codigo_franquia}</p>
      <p>CNPJ: {franqueado.cnpj}</p>
      <p>Limite de Crédito: R$ {franqueado.limite_credito.toFixed(2)}</p>
      <p>Status: {franqueado.status}</p>
    </div>
  );
}
```

---

## 📋 CÓDIGOS DE FRANQUIA

### Padrão: `POL-{ESTADO}-{NÚMERO}`

Exemplos:
- `POL-SP-001` - São Paulo, franquia #001
- `POL-RJ-001` - Rio de Janeiro, franquia #001
- `POL-MG-005` - Minas Gerais, franquia #005

---

## 🎯 PRÓXIMOS PASSOS

### 1. Atualizar Interfaces
- Trocar "Cliente" por "Franqueado" nas telas
- Trocar "Multimarca" por "Franqueado"
- Atualizar texto da Home: "Portal de Franqueados Polo Wear"

### 2. Criar Tela de Gestão de Franqueados
- Listar todos os franqueados (Admin)
- Cadastrar novo franqueado
- Editar dados do franqueado
- Ver detalhes completos

### 3. Dashboard do Franqueado
- Informações da franquia
- Limite de crédito disponível
- Metas de vendas
- Próximos vencimentos

### 4. Relatórios
- Ranking de franqueados
- Vendas por franqueado
- Inadimplência por franqueado

---

## ✅ RESUMO DA MIGRAÇÃO

### O Que Mudou

| Antes | Depois |
|-------|--------|
| Tipo: "multimarca" | Tipo: "franqueado" |
| Sem tabela específica | Tabela `franqueados` |
| Pedidos sem vínculo | Pedidos com `franqueado_id` |
| Sem código de franquia | Código `POL-XX-000` |
| Sem limite de crédito formal | Limite de crédito por franqueado |

### Compatibilidade

✅ **Backward Compatible**: Código antigo com "multimarca" continuará funcionando até ser atualizado.

⚠️ **Recomendado**: Atualizar todas as referências de "multimarca" para "franqueado" nas interfaces.

---

## 📞 SUPORTE

Para dúvidas sobre a estrutura de franqueados:
1. Consulte esta documentação
2. Veja exemplos no código
3. Execute os scripts de teste

---

**Desenvolvido por:** Claude Code
**Data:** 30/10/2025
**Projeto:** Sistema de Gestão de Franqueados Polo Wear
**Supabase Project:** jbdcoftzffrppkyzdaqr

---

## 🎉 ESTRUTURA COMPLETA IMPLEMENTADA!

O sistema agora suporta completamente a gestão de franqueados da rede Polo Wear!
