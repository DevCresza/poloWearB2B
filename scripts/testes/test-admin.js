// Script de Teste - Nível Admin
// Execute: node scripts/testes/test-admin.js

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
try { process.loadEnvFile(resolve(__dirname, '../../.env')); } catch { /* sem .env: usa o ambiente */ }

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Dados do admin
const ADMIN = {
  email: 'admin@polo-b2b.com',
  password: 'admin123'
};

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}: ${message}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${name}: ${message}`);
  }
  testResults.tests.push({ name, passed, message });
}

async function test(name, fn) {
  try {
    await fn();
    logTest(name, true, 'Passou');
  } catch (error) {
    logTest(name, false, error.message);
  }
}

console.log('🧪 ========================================');
console.log('🧪 TESTES - NÍVEL ADMIN');
console.log('🧪 ========================================\n');

// ============================================
// 1. AUTENTICAÇÃO
// ============================================
console.log('📋 1. AUTENTICAÇÃO');
console.log('----------------------------------------');

await test('1.1 - Login Admin', async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN.email,
    password: ADMIN.password
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Usuário não retornado');

  console.log(`   → User ID: ${data.user.id}`);
});

await test('1.2 - Verificar Sessão', async () => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) throw new Error(error.message);
  if (!session) throw new Error('Sessão não encontrada');

  console.log(`   → Token válido`);
});

await test('1.3 - Buscar Dados do Admin', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', ADMIN.email)
    .single();

  if (error) throw new Error(error.message);
  if (data.role !== 'admin') throw new Error(`Role incorreta: ${data.role}`);

  console.log(`   → Nome: ${data.full_name}`);
  console.log(`   → Role: ${data.role}`);
});

// ============================================
// 2. GESTÃO DE USUÁRIOS
// ============================================
console.log('\n📋 2. GESTÃO DE USUÁRIOS');
console.log('----------------------------------------');

await test('2.1 - Listar Todos os Usuários', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) throw new Error(error.message);

  console.log(`   → Total de usuários: ${data.length}`);
  data.forEach(u => console.log(`      - ${u.full_name} (${u.role})`));
});

await test('2.2 - Filtrar Usuários por Tipo', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tipo_negocio', 'multimarca');

  if (error) throw new Error(error.message);

  console.log(`   → Clientes multimarca: ${data.length}`);
});

await test('2.3 - Contar Usuários Ativos', async () => {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true);

  if (error) throw new Error(error.message);

  console.log(`   → Usuários ativos: ${count}`);
});

// ============================================
// 3. GESTÃO DE PRODUTOS
// ============================================
console.log('\n📋 3. GESTÃO DE PRODUTOS');
console.log('----------------------------------------');

let novoProdutoId = null;

await test('3.1 - Listar Todos os Produtos', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  console.log(`   → Total de produtos: ${data.length}`);
  data.slice(0, 3).forEach(p => console.log(`      - ${p.nome} (${p.marca})`));
});

await test('3.2 - Criar Novo Produto', async () => {
  const { data: fornecedor } = await supabase
    .from('fornecedores')
    .select('id')
    .eq('nome_marca', 'Polo Wear')
    .single();

  const { data, error } = await supabase
    .from('produtos')
    .insert([{
      nome: 'Produto Teste Admin',
      marca: 'Polo Wear',
      categoria: 'Testes',
      fornecedor_id: fornecedor.id,
      preco_por_peca: 99.90,
      estoque_atual_grades: 10,
      ativo: true
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novoProdutoId = data.id;
  console.log(`   → Produto criado: ${data.nome} (ID: ${data.id})`);
});

await test('3.3 - Atualizar Produto', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { data, error } = await supabase
    .from('produtos')
    .update({ preco_por_peca: 79.90 })
    .eq('id', novoProdutoId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Preço atualizado: R$ ${data.preco_por_peca}`);
});

await test('3.4 - Filtrar Produtos por Marca', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('marca', 'MX');

  if (error) throw new Error(error.message);

  console.log(`   → Produtos MX: ${data.length}`);
});

await test('3.5 - Deletar Produto Teste', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', novoProdutoId);

  if (error) throw new Error(error.message);

  console.log(`   → Produto deletado com sucesso`);
});

// ============================================
// 4. GESTÃO DE FORNECEDORES
// ============================================
console.log('\n📋 4. GESTÃO DE FORNECEDORES');
console.log('----------------------------------------');

await test('4.1 - Listar Todos os Fornecedores', async () => {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*');

  if (error) throw new Error(error.message);

  console.log(`   → Total de fornecedores: ${data.length}`);
  data.forEach(f => console.log(`      - ${f.nome_marca}`));
});

await test('4.2 - Buscar Fornecedor por ID', async () => {
  const { data: fornecedores } = await supabase
    .from('fornecedores')
    .select('id')
    .limit(1);

  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', fornecedores[0].id)
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Fornecedor: ${data.nome_marca}`);
});

// ============================================
// 5. GESTÃO DE PEDIDOS
// ============================================
console.log('\n📋 5. GESTÃO DE PEDIDOS');
console.log('----------------------------------------');

let novoPedidoId = null;

await test('5.1 - Listar Todos os Pedidos', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .order('created_date', { ascending: false });

  if (error) throw new Error(error.message);

  console.log(`   → Total de pedidos: ${data.length}`);
});

await test('5.2 - Criar Novo Pedido', async () => {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('tipo_negocio', 'multimarca')
    .limit(1)
    .single();

  const { data: fornecedor } = await supabase
    .from('fornecedores')
    .select('id')
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('pedidos')
    .insert([{
      comprador_user_id: user.id,
      fornecedor_id: fornecedor.id,
      status: 'novo_pedido',
      status_pagamento: 'pendente',
      valor_total: 500.00,
      valor_final: 500.00,
      itens: [{
        produto_id: 'teste',
        quantidade: 5,
        preco: 100.00
      }]
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novoPedidoId = data.id;
  console.log(`   → Pedido criado: ${data.id}`);
  console.log(`   → Valor: R$ ${data.valor_total}`);
});

await test('5.3 - Atualizar Status do Pedido', async () => {
  if (!novoPedidoId) throw new Error('Pedido não foi criado');

  const { data, error } = await supabase
    .from('pedidos')
    .update({ status: 'em_producao' })
    .eq('id', novoPedidoId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Status atualizado: ${data.status}`);
});

await test('5.4 - Filtrar Pedidos por Status', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('status', 'novo_pedido');

  if (error) throw new Error(error.message);

  console.log(`   → Pedidos novos: ${data.length}`);
});

// ============================================
// 6. GESTÃO DE CONTATOS (CRM)
// ============================================
console.log('\n📋 6. GESTÃO DE CONTATOS (CRM)');
console.log('----------------------------------------');

let novoContatoId = null;

await test('6.1 - Criar Novo Contato', async () => {
  const { data, error } = await supabase
    .from('contacts')
    .insert([{
      nome: 'Lead Teste',
      email: 'lead@teste.com',
      telefone: '(11) 99999-0000',
      empresa: 'Empresa Teste',
      cidade: 'São Paulo',
      estado: 'SP',
      status: 'novo'
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novoContatoId = data.id;
  console.log(`   → Contato criado: ${data.nome}`);
});

await test('6.2 - Listar Contatos', async () => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  console.log(`   → Total de contatos: ${data.length}`);
});

await test('6.3 - Filtrar Contatos por Status', async () => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'novo');

  if (error) throw new Error(error.message);

  console.log(`   → Contatos novos: ${data.length}`);
});

// ============================================
// 7. GESTÃO FINANCEIRA (CARTEIRA)
// ============================================
console.log('\n📋 7. GESTÃO FINANCEIRA (CARTEIRA)');
console.log('----------------------------------------');

let novoTituloId = null;

await test('7.1 - Criar Título a Receber', async () => {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('tipo_negocio', 'multimarca')
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('carteira')
    .insert([{
      cliente_user_id: user.id,
      tipo: 'a_receber',
      descricao: 'Pedido #001',
      valor: 1500.00,
      data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendente'
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novoTituloId = data.id;
  console.log(`   → Título criado: R$ ${data.valor}`);
});

await test('7.2 - Listar Títulos Pendentes', async () => {
  const { data, error } = await supabase
    .from('carteira')
    .select('*')
    .eq('status', 'pendente');

  if (error) throw new Error(error.message);

  console.log(`   → Títulos pendentes: ${data.length}`);
});

await test('7.3 - Marcar Título como Pago', async () => {
  if (!novoTituloId) throw new Error('Título não foi criado');

  const { data, error } = await supabase
    .from('carteira')
    .update({
      status: 'pago',
      data_pagamento: new Date().toISOString().split('T')[0]
    })
    .eq('id', novoTituloId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Título marcado como pago`);
});

// ============================================
// 8. GESTÃO DE METAS
// ============================================
console.log('\n📋 8. GESTÃO DE METAS');
console.log('----------------------------------------');

let novaMetaId = null;

await test('8.1 - Criar Meta Mensal', async () => {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('tipo_negocio', 'multimarca')
    .limit(1)
    .single();

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const { data, error } = await supabase
    .from('metas')
    .insert([{
      user_id: user.id,
      tipo: 'mensal',
      periodo_inicio: primeiroDia.toISOString().split('T')[0],
      periodo_fim: ultimoDia.toISOString().split('T')[0],
      valor_meta: 50000.00,
      valor_atual: 0,
      percentual_atingido: 0,
      status: 'ativa'
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novaMetaId = data.id;
  console.log(`   → Meta criada: R$ ${data.valor_meta}`);
});

await test('8.2 - Atualizar Progresso da Meta', async () => {
  if (!novaMetaId) throw new Error('Meta não foi criada');

  const { data, error } = await supabase
    .from('metas')
    .update({
      valor_atual: 35000.00,
      percentual_atingido: 70.00
    })
    .eq('id', novaMetaId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Progresso: ${data.percentual_atingido}%`);
});

await test('8.3 - Listar Metas Ativas', async () => {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .eq('status', 'ativa');

  if (error) throw new Error(error.message);

  console.log(`   → Metas ativas: ${data.length}`);
});

// ============================================
// 9. LIMPEZA
// ============================================
console.log('\n📋 9. LIMPEZA DE DADOS DE TESTE');
console.log('----------------------------------------');

await test('9.1 - Deletar Pedido Teste', async () => {
  if (!novoPedidoId) {
    console.log('   → Nenhum pedido para deletar');
    return;
  }

  const { error } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', novoPedidoId);

  if (error) throw new Error(error.message);

  console.log(`   → Pedido deletado`);
});

await test('9.2 - Deletar Contato Teste', async () => {
  if (!novoContatoId) {
    console.log('   → Nenhum contato para deletar');
    return;
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', novoContatoId);

  if (error) throw new Error(error.message);

  console.log(`   → Contato deletado`);
});

await test('9.3 - Deletar Título Teste', async () => {
  if (!novoTituloId) {
    console.log('   → Nenhum título para deletar');
    return;
  }

  const { error } = await supabase
    .from('carteira')
    .delete()
    .eq('id', novoTituloId);

  if (error) throw new Error(error.message);

  console.log(`   → Título deletado`);
});

await test('9.4 - Deletar Meta Teste', async () => {
  if (!novaMetaId) {
    console.log('   → Nenhuma meta para deletar');
    return;
  }

  const { error } = await supabase
    .from('metas')
    .delete()
    .eq('id', novaMetaId);

  if (error) throw new Error(error.message);

  console.log(`   → Meta deletada`);
});

// ============================================
// RELATÓRIO FINAL
// ============================================
console.log('\n');
console.log('🧪 ========================================');
console.log('🧪 RELATÓRIO FINAL - TESTES ADMIN');
console.log('🧪 ========================================');
console.log(`📊 Total de Testes: ${testResults.total}`);
console.log(`✅ Testes Passaram: ${testResults.passed}`);
console.log(`❌ Testes Falharam: ${testResults.failed}`);
console.log(`📈 Taxa de Sucesso: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
console.log('🧪 ========================================\n');

// Salvar relatório em arquivo
import { writeFileSync } from 'fs';
const relatorio = {
  nivel: 'ADMIN',
  data: new Date().toISOString(),
  resultados: testResults
};

writeFileSync(
  resolve(__dirname, 'relatorio-admin.json'),
  JSON.stringify(relatorio, null, 2)
);

console.log('📄 Relatório salvo em: scripts/testes/relatorio-admin.json\n');

// Sair com código de erro se houver falhas
process.exit(testResults.failed > 0 ? 1 : 0);
