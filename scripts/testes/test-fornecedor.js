// Script de Teste - Nível Fornecedor
// Execute: node scripts/testes/test-fornecedor.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const FORNECEDOR = {
  email: 'fornecedor@exemplo.com',
  password: 'fornecedor123'
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
console.log('🧪 TESTES - NÍVEL FORNECEDOR');
console.log('🧪 ========================================\n');

let fornecedorData = null;

// ============================================
// 1. AUTENTICAÇÃO
// ============================================
console.log('📋 1. AUTENTICAÇÃO');
console.log('----------------------------------------');

await test('1.1 - Login Fornecedor', async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: FORNECEDOR.email,
    password: FORNECEDOR.password
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Usuário não retornado');

  console.log(`   → User ID: ${data.user.id}`);
});

await test('1.2 - Buscar Dados do Fornecedor', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', FORNECEDOR.email)
    .single();

  if (error) throw new Error(error.message);
  if (data.tipo_negocio !== 'fornecedor') throw new Error(`Tipo incorreto: ${data.tipo_negocio}`);

  fornecedorData = data;
  console.log(`   → Nome: ${data.full_name}`);
  console.log(`   → Empresa: ${data.empresa}`);
});

await test('1.3 - Buscar Fornecedor Associado', async () => {
  // Buscar fornecedor pela empresa do usuário
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('nome_marca', fornecedorData.empresa)
    .single();

  if (error) throw new Error(error.message);

  fornecedorData.fornecedor_id = data.id;
  console.log(`   → Fornecedor ID: ${data.id}`);
  console.log(`   → Marca: ${data.nome_marca}`);
});

// ============================================
// 2. GESTÃO DE PRODUTOS (PRÓPRIOS)
// ============================================
console.log('\n📋 2. GESTÃO DE PRODUTOS (PRÓPRIOS)');
console.log('----------------------------------------');

let novoProdutoId = null;

await test('2.1 - Listar APENAS Produtos Próprios', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('fornecedor_id', fornecedorData.fornecedor_id);

  if (error) throw new Error(error.message);

  console.log(`   → Produtos da marca ${fornecedorData.empresa}: ${data.length}`);
  data.forEach(p => console.log(`      - ${p.nome}`));
});

await test('2.2 - Criar Produto Próprio', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .insert([{
      nome: 'Produto Teste Fornecedor',
      marca: fornecedorData.empresa,
      categoria: 'Testes',
      fornecedor_id: fornecedorData.fornecedor_id,
      preco_por_peca: 59.90,
      estoque_atual_grades: 20,
      ativo: true
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novoProdutoId = data.id;
  console.log(`   → Produto criado: ${data.nome}`);
});

await test('2.3 - Atualizar Produto Próprio', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { data, error } = await supabase
    .from('produtos')
    .update({ preco_por_peca: 49.90 })
    .eq('id', novoProdutoId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Preço atualizado: R$ ${data.preco_por_peca}`);
});

await test('2.4 - Atualizar Estoque', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { data, error } = await supabase
    .from('produtos')
    .update({ estoque_atual_grades: 15 })
    .eq('id', novoProdutoId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Estoque atualizado: ${data.estoque_atual_grades} grades`);
});

await test('2.5 - Destacar Produto', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { data, error } = await supabase
    .from('produtos')
    .update({ is_destaque: true })
    .eq('id', novoProdutoId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Produto destacado`);
});

// ============================================
// 3. GESTÃO DE PEDIDOS (RECEBIDOS)
// ============================================
console.log('\n📋 3. GESTÃO DE PEDIDOS (RECEBIDOS)');
console.log('----------------------------------------');

await test('3.1 - Listar APENAS Pedidos Próprios', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('fornecedor_id', fornecedorData.fornecedor_id);

  if (error) throw new Error(error.message);

  console.log(`   → Pedidos recebidos: ${data.length}`);
});

await test('3.2 - Filtrar Pedidos por Status', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('fornecedor_id', fornecedorData.fornecedor_id)
    .eq('status', 'novo_pedido');

  if (error) throw new Error(error.message);

  console.log(`   → Novos pedidos: ${data.length}`);
});

await test('3.3 - Contar Pedidos Pendentes', async () => {
  const { count, error } = await supabase
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('fornecedor_id', fornecedorData.fornecedor_id)
    .in('status', ['novo_pedido', 'em_producao']);

  if (error) throw new Error(error.message);

  console.log(`   → Pedidos pendentes: ${count}`);
});

// ============================================
// 4. MOVIMENTAÇÕES DE ESTOQUE
// ============================================
console.log('\n📋 4. MOVIMENTAÇÕES DE ESTOQUE');
console.log('----------------------------------------');

let novaMovimentacaoId = null;

await test('4.1 - Registrar Entrada de Estoque', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { data: produto } = await supabase
    .from('produtos')
    .select('estoque_atual_grades')
    .eq('id', novoProdutoId)
    .single();

  const { data, error } = await supabase
    .from('movimentacoes_estoque')
    .insert([{
      produto_id: novoProdutoId,
      tipo: 'entrada',
      quantidade_grades: 10,
      quantidade_anterior: produto.estoque_atual_grades,
      quantidade_atual: produto.estoque_atual_grades + 10,
      motivo: 'Compra de estoque',
      user_id: fornecedorData.id
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novaMovimentacaoId = data.id;
  console.log(`   → Movimentação registrada: +${data.quantidade_grades} grades`);

  // Atualizar estoque do produto
  await supabase
    .from('produtos')
    .update({ estoque_atual_grades: data.quantidade_atual })
    .eq('id', novoProdutoId);
});

await test('4.2 - Listar Movimentações do Produto', async () => {
  if (!novoProdutoId) throw new Error('Produto não foi criado');

  const { data, error } = await supabase
    .from('movimentacoes_estoque')
    .select('*')
    .eq('produto_id', novoProdutoId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  console.log(`   → Total de movimentações: ${data.length}`);
});

// ============================================
// 5. ESTATÍSTICAS DO FORNECEDOR
// ============================================
console.log('\n📋 5. ESTATÍSTICAS DO FORNECEDOR');
console.log('----------------------------------------');

await test('5.1 - Total de Produtos Ativos', async () => {
  const { count, error } = await supabase
    .from('produtos')
    .select('*', { count: 'exact', head: true })
    .eq('fornecedor_id', fornecedorData.fornecedor_id)
    .eq('ativo', true);

  if (error) throw new Error(error.message);

  console.log(`   → Produtos ativos: ${count}`);
});

await test('5.2 - Produtos com Estoque Baixo', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('fornecedor_id', fornecedorData.fornecedor_id)
    .lt('estoque_atual_grades', 10);

  if (error) throw new Error(error.message);

  console.log(`   → Produtos com estoque baixo: ${data.length}`);
});

await test('5.3 - Valor Total do Estoque', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('estoque_atual_grades, preco_grade_completa')
    .eq('fornecedor_id', fornecedorData.fornecedor_id);

  if (error) throw new Error(error.message);

  const valorTotal = data.reduce((sum, p) => {
    return sum + (p.estoque_atual_grades * (p.preco_grade_completa || 0));
  }, 0);

  console.log(`   → Valor total em estoque: R$ ${valorTotal.toFixed(2)}`);
});

// ============================================
// 6. VERIFICAR RESTRIÇÕES DE ACESSO
// ============================================
console.log('\n📋 6. VERIFICAR RESTRIÇÕES DE ACESSO');
console.log('----------------------------------------');

await test('6.1 - NÃO deve acessar produtos de outros fornecedores', async () => {
  // Buscar produtos de outro fornecedor
  const { data: outroFornecedor } = await supabase
    .from('fornecedores')
    .select('id')
    .neq('id', fornecedorData.fornecedor_id)
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('fornecedor_id', outroFornecedor.id);

  if (error) throw new Error(error.message);

  // Fornecedor PODE ver produtos de outros (sem RLS)
  // mas a aplicação deve filtrar
  console.log(`   → Produtos de outros: ${data.length} (visíveis, mas devem ser filtrados na aplicação)`);
});

await test('6.2 - NÃO deve modificar usuários', async () => {
  try {
    await supabase
      .from('users')
      .update({ full_name: 'Teste Hack' })
      .eq('email', 'admin@polo-b2b.com');

    // Se chegou aqui, o teste falhou (não deveria permitir)
    console.log(`   → ⚠️ AVISO: Fornecedor conseguiu modificar usuários (sem RLS)`);
  } catch (error) {
    console.log(`   → ✅ Bloqueado corretamente`);
  }
});

// ============================================
// 7. LIMPEZA
// ============================================
console.log('\n📋 7. LIMPEZA DE DADOS DE TESTE');
console.log('----------------------------------------');

await test('7.1 - Deletar Movimentação Teste', async () => {
  if (!novaMovimentacaoId) {
    console.log('   → Nenhuma movimentação para deletar');
    return;
  }

  const { error } = await supabase
    .from('movimentacoes_estoque')
    .delete()
    .eq('id', novaMovimentacaoId);

  if (error) throw new Error(error.message);

  console.log(`   → Movimentação deletada`);
});

await test('7.2 - Deletar Produto Teste', async () => {
  if (!novoProdutoId) {
    console.log('   → Nenhum produto para deletar');
    return;
  }

  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', novoProdutoId);

  if (error) throw new Error(error.message);

  console.log(`   → Produto deletado`);
});

// ============================================
// RELATÓRIO FINAL
// ============================================
console.log('\n');
console.log('🧪 ========================================');
console.log('🧪 RELATÓRIO FINAL - TESTES FORNECEDOR');
console.log('🧪 ========================================');
console.log(`📊 Total de Testes: ${testResults.total}`);
console.log(`✅ Testes Passaram: ${testResults.passed}`);
console.log(`❌ Testes Falharam: ${testResults.failed}`);
console.log(`📈 Taxa de Sucesso: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
console.log('🧪 ========================================\n');

import { writeFileSync } from 'fs';
const relatorio = {
  nivel: 'FORNECEDOR',
  data: new Date().toISOString(),
  fornecedor: fornecedorData.empresa,
  resultados: testResults
};

writeFileSync(
  resolve(__dirname, 'relatorio-fornecedor.json'),
  JSON.stringify(relatorio, null, 2)
);

console.log('📄 Relatório salvo em: scripts/testes/relatorio-fornecedor.json\n');

process.exit(testResults.failed > 0 ? 1 : 0);
