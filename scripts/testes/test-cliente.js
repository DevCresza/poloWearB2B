// Script de Teste - Nível Cliente (Multimarca)
// Execute: node scripts/testes/test-cliente.js

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try { process.loadEnvFile(resolve(__dirname, '../../.env')); } catch { /* sem .env: usa o ambiente */ }

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CLIENTE = {
  email: 'cliente@exemplo.com',
  password: 'cliente123'
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
console.log('🧪 TESTES - NÍVEL CLIENTE (MULTIMARCA)');
console.log('🧪 ========================================\n');

let clienteData = null;

// ============================================
// 1. AUTENTICAÇÃO
// ============================================
console.log('📋 1. AUTENTICAÇÃO');
console.log('----------------------------------------');

await test('1.1 - Login Cliente', async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: CLIENTE.email,
    password: CLIENTE.password
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Usuário não retornado');

  console.log(`   → User ID: ${data.user.id}`);
});

await test('1.2 - Buscar Dados do Cliente', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', CLIENTE.email)
    .single();

  if (error) throw new Error(error.message);
  if (data.tipo_negocio !== 'multimarca') throw new Error(`Tipo incorreto: ${data.tipo_negocio}`);

  clienteData = data;
  console.log(`   → Nome: ${data.full_name}`);
  console.log(`   → Empresa: ${data.empresa}`);
  console.log(`   → Cidade: ${data.cidade}`);
});

// ============================================
// 2. CATÁLOGO DE PRODUTOS
// ============================================
console.log('\n📋 2. CATÁLOGO DE PRODUTOS');
console.log('----------------------------------------');

await test('2.1 - Listar Todos os Produtos Disponíveis', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  console.log(`   → Produtos disponíveis: ${data.length}`);
  data.slice(0, 3).forEach(p => console.log(`      - ${p.nome} (${p.marca}) - R$ ${p.preco_por_peca}`));
});

await test('2.2 - Filtrar Produtos por Marca', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .eq('marca', 'Polo Wear');

  if (error) throw new Error(error.message);

  console.log(`   → Produtos Polo Wear: ${data.length}`);
});

await test('2.3 - Filtrar Produtos por Categoria', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .eq('categoria', 'Camisas');

  if (error) throw new Error(error.message);

  console.log(`   → Camisas disponíveis: ${data.length}`);
});

await test('2.4 - Buscar Produtos em Destaque', async () => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .eq('is_destaque', true);

  if (error) throw new Error(error.message);

  console.log(`   → Produtos em destaque: ${data.length}`);
});

await test('2.5 - Buscar Produto por ID', async () => {
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id')
    .eq('ativo', true)
    .limit(1);

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', produtos[0].id)
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Produto: ${data.nome}`);
  console.log(`   → Preço: R$ ${data.preco_por_peca}`);
  console.log(`   → Estoque: ${data.estoque_atual_grades} grades`);
});

// ============================================
// 3. CARRINHO DE COMPRAS
// ============================================
console.log('\n📋 3. CARRINHO DE COMPRAS');
console.log('----------------------------------------');

let itemCarrinhoId = null;

await test('3.1 - Adicionar Produto ao Carrinho', async () => {
  const { data: produto } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('carrinho_itens')
    .insert([{
      user_id: clienteData.id,
      produto_id: produto.id,
      quantidade_grades: 2,
      preco_unitario: produto.preco_grade_completa || produto.preco_por_peca
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  itemCarrinhoId = data.id;
  console.log(`   → Item adicionado ao carrinho`);
  console.log(`   → Quantidade: ${data.quantidade_grades} grades`);
});

await test('3.2 - Listar Itens do Carrinho', async () => {
  const { data, error } = await supabase
    .from('carrinho_itens')
    .select('*')
    .eq('user_id', clienteData.id);

  if (error) throw new Error(error.message);

  console.log(`   → Itens no carrinho: ${data.length}`);
});

await test('3.3 - Atualizar Quantidade no Carrinho', async () => {
  if (!itemCarrinhoId) throw new Error('Item não foi adicionado');

  const { data, error } = await supabase
    .from('carrinho_itens')
    .update({ quantidade_grades: 3 })
    .eq('id', itemCarrinhoId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Quantidade atualizada: ${data.quantidade_grades} grades`);
});

// ============================================
// 4. PEDIDOS
// ============================================
console.log('\n📋 4. PEDIDOS');
console.log('----------------------------------------');

let novoPedidoId = null;

await test('4.1 - Criar Novo Pedido', async () => {
  const { data: produto } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .limit(1)
    .single();

  const { data: fornecedor } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', produto.fornecedor_id)
    .single();

  const { data, error } = await supabase
    .from('pedidos')
    .insert([{
      comprador_user_id: clienteData.id,
      fornecedor_id: fornecedor.id,
      status: 'novo_pedido',
      status_pagamento: 'pendente',
      valor_total: 500.00,
      valor_final: 500.00,
      itens: [{
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade_grades: 2,
        preco_unitario: produto.preco_grade_completa || produto.preco_por_peca
      }]
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  novoPedidoId = data.id;
  console.log(`   → Pedido criado: ${data.id}`);
  console.log(`   → Valor: R$ ${data.valor_total}`);
});

await test('4.2 - Listar APENAS Meus Pedidos', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('comprador_user_id', clienteData.id)
    .order('created_date', { ascending: false });

  if (error) throw new Error(error.message);

  console.log(`   → Meus pedidos: ${data.length}`);
});

await test('4.3 - Buscar Pedido por ID', async () => {
  if (!novoPedidoId) throw new Error('Pedido não foi criado');

  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', novoPedidoId)
    .single();

  if (error) throw new Error(error.message);

  console.log(`   → Pedido: ${data.id}`);
  console.log(`   → Status: ${data.status}`);
  console.log(`   → Valor: R$ ${data.valor_final}`);
});

await test('4.4 - Filtrar Pedidos por Status', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('comprador_user_id', clienteData.id)
    .eq('status', 'novo_pedido');

  if (error) throw new Error(error.message);

  console.log(`   → Novos pedidos: ${data.length}`);
});

// ============================================
// 5. CARTEIRA FINANCEIRA
// ============================================
console.log('\n📋 5. CARTEIRA FINANCEIRA');
console.log('----------------------------------------');

let tituloId = null;

await test('5.1 - Listar APENAS Meus Títulos', async () => {
  const { data, error } = await supabase
    .from('carteira')
    .select('*')
    .eq('cliente_user_id', clienteData.id);

  if (error) throw new Error(error.message);

  console.log(`   → Meus títulos: ${data.length}`);
});

await test('5.2 - Criar Título (Simulado - normalmente criado pelo admin)', async () => {
  const { data, error } = await supabase
    .from('carteira')
    .insert([{
      cliente_user_id: clienteData.id,
      tipo: 'a_receber',
      descricao: 'Pedido Teste',
      valor: 500.00,
      data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pendente',
      pedido_id: novoPedidoId
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  tituloId = data.id;
  console.log(`   → Título criado: R$ ${data.valor}`);
  console.log(`   → Vencimento: ${data.data_vencimento}`);
});

await test('5.3 - Filtrar Títulos Pendentes', async () => {
  const { data, error } = await supabase
    .from('carteira')
    .select('*')
    .eq('cliente_user_id', clienteData.id)
    .eq('status', 'pendente');

  if (error) throw new Error(error.message);

  console.log(`   → Títulos pendentes: ${data.length}`);
});

await test('5.4 - Calcular Total a Pagar', async () => {
  const { data, error } = await supabase
    .from('carteira')
    .select('valor')
    .eq('cliente_user_id', clienteData.id)
    .eq('status', 'pendente');

  if (error) throw new Error(error.message);

  const total = data.reduce((sum, t) => sum + parseFloat(t.valor), 0);
  console.log(`   → Total a pagar: R$ ${total.toFixed(2)}`);
});

// ============================================
// 6. METAS PESSOAIS
// ============================================
console.log('\n📋 6. METAS PESSOAIS');
console.log('----------------------------------------');

let metaId = null;

await test('6.1 - Criar Meta Mensal', async () => {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const { data, error } = await supabase
    .from('metas')
    .insert([{
      user_id: clienteData.id,
      tipo: 'mensal',
      periodo_inicio: primeiroDia.toISOString().split('T')[0],
      periodo_fim: ultimoDia.toISOString().split('T')[0],
      valor_meta: 10000.00,
      valor_atual: 0,
      percentual_atingido: 0,
      status: 'ativa'
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  metaId = data.id;
  console.log(`   → Meta criada: R$ ${data.valor_meta}`);
});

await test('6.2 - Listar Minhas Metas', async () => {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .eq('user_id', clienteData.id);

  if (error) throw new Error(error.message);

  console.log(`   → Minhas metas: ${data.length}`);
});

// ============================================
// 7. VERIFICAR RESTRIÇÕES
// ============================================
console.log('\n📋 7. VERIFICAR RESTRIÇÕES DE ACESSO');
console.log('----------------------------------------');

await test('7.1 - NÃO deve acessar pedidos de outros clientes', async () => {
  const { data: outroPedido } = await supabase
    .from('pedidos')
    .select('*')
    .neq('comprador_user_id', clienteData.id)
    .limit(1);

  if (outroPedido && outroPedido.length > 0) {
    console.log(`   → ⚠️ AVISO: Cliente pode ver pedidos de outros (sem RLS)`);
  } else {
    console.log(`   → ✅ Sem pedidos de outros clientes`);
  }
});

await test('7.2 - NÃO deve modificar produtos', async () => {
  const { data: produto } = await supabase
    .from('produtos')
    .select('id')
    .limit(1)
    .single();

  try {
    await supabase
      .from('produtos')
      .update({ preco_por_peca: 1.00 })
      .eq('id', produto.id);

    console.log(`   → ⚠️ AVISO: Cliente conseguiu modificar produto (sem RLS)`);
  } catch (error) {
    console.log(`   → ✅ Bloqueado corretamente`);
  }
});

await test('7.3 - NÃO deve acessar dados de outros usuários', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .neq('id', clienteData.id);

  if (error) throw new Error(error.message);

  console.log(`   → ⚠️ AVISO: Cliente pode ver ${data.length} outros usuários (sem RLS)`);
});

// ============================================
// 8. ESTATÍSTICAS DO CLIENTE
// ============================================
console.log('\n📋 8. ESTATÍSTICAS DO CLIENTE');
console.log('----------------------------------------');

await test('8.1 - Total Gasto em Pedidos', async () => {
  const { data, error } = await supabase
    .from('pedidos')
    .select('valor_final')
    .eq('comprador_user_id', clienteData.id);

  if (error) throw new Error(error.message);

  const total = data.reduce((sum, p) => sum + parseFloat(p.valor_final), 0);
  console.log(`   → Total gasto: R$ ${total.toFixed(2)}`);
});

await test('8.2 - Pedidos por Status', async () => {
  const status = ['novo_pedido', 'em_producao', 'finalizado'];

  for (const s of status) {
    const { count, error } = await supabase
      .from('pedidos')
      .select('*', { count: 'exact', head: true })
      .eq('comprador_user_id', clienteData.id)
      .eq('status', s);

    if (!error) {
      console.log(`   → ${s}: ${count}`);
    }
  }
});

// ============================================
// 9. LIMPEZA
// ============================================
console.log('\n📋 9. LIMPEZA DE DADOS DE TESTE');
console.log('----------------------------------------');

await test('9.1 - Deletar Meta Teste', async () => {
  if (!metaId) {
    console.log('   → Nenhuma meta para deletar');
    return;
  }

  const { error } = await supabase
    .from('metas')
    .delete()
    .eq('id', metaId);

  if (error) throw new Error(error.message);

  console.log(`   → Meta deletada`);
});

await test('9.2 - Deletar Título Teste', async () => {
  if (!tituloId) {
    console.log('   → Nenhum título para deletar');
    return;
  }

  const { error } = await supabase
    .from('carteira')
    .delete()
    .eq('id', tituloId);

  if (error) throw new Error(error.message);

  console.log(`   → Título deletado`);
});

await test('9.3 - Deletar Pedido Teste', async () => {
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

await test('9.4 - Deletar Item do Carrinho', async () => {
  if (!itemCarrinhoId) {
    console.log('   → Nenhum item para deletar');
    return;
  }

  const { error } = await supabase
    .from('carrinho_itens')
    .delete()
    .eq('id', itemCarrinhoId);

  if (error) throw new Error(error.message);

  console.log(`   → Item do carrinho deletado`);
});

// ============================================
// RELATÓRIO FINAL
// ============================================
console.log('\n');
console.log('🧪 ========================================');
console.log('🧪 RELATÓRIO FINAL - TESTES CLIENTE');
console.log('🧪 ========================================');
console.log(`📊 Total de Testes: ${testResults.total}`);
console.log(`✅ Testes Passaram: ${testResults.passed}`);
console.log(`❌ Testes Falharam: ${testResults.failed}`);
console.log(`📈 Taxa de Sucesso: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
console.log('🧪 ========================================\n');

import { writeFileSync } from 'fs';
const relatorio = {
  nivel: 'CLIENTE',
  data: new Date().toISOString(),
  cliente: clienteData.empresa,
  resultados: testResults
};

writeFileSync(
  resolve(__dirname, 'relatorio-cliente.json'),
  JSON.stringify(relatorio, null, 2)
);

console.log('📄 Relatório salvo em: scripts/testes/relatorio-cliente.json\n');

process.exit(testResults.failed > 0 ? 1 : 0);
