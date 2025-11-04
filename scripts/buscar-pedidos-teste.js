// Script para Buscar Pedidos de Teste do Supabase
// Execute: node scripts/buscar-pedidos-teste.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 ========================================');
console.log('🔍 BUSCAR PEDIDOS DE TESTE');
console.log('🔍 ========================================\n');

try {
  // Buscar todos os pedidos
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('*')
    .order('created_date', { ascending: false });

  if (error) throw error;

  console.log(`📦 Total de pedidos encontrados: ${pedidos.length}\n`);

  if (pedidos.length === 0) {
    console.log('❌ Nenhum pedido encontrado no banco de dados.\n');
    process.exit(0);
  }

  // Exibir cada pedido
  pedidos.forEach((pedido, index) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 PEDIDO #${index + 1}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${pedido.id}`);
    console.log(`Cliente ID: ${pedido.comprador_user_id}`);
    console.log(`Fornecedor ID: ${pedido.fornecedor_id}`);
    console.log(`Status: ${pedido.status}`);
    console.log(`Status Pagamento: ${pedido.status_pagamento || 'N/A'}`);
    console.log(`Valor Total: R$ ${pedido.valor_total?.toFixed(2) || '0.00'}`);
    console.log(`Valor Final: R$ ${pedido.valor_final?.toFixed(2) || '0.00'}`);
    console.log(`Data Criação: ${pedido.created_date || 'N/A'}`);
    console.log(`Data Atualização: ${pedido.updated_at || 'N/A'}`);

    // Itens do pedido
    if (pedido.itens && Array.isArray(pedido.itens)) {
      console.log(`\n📦 Itens (${pedido.itens.length}):`);
      pedido.itens.forEach((item, idx) => {
        console.log(`   ${idx + 1}. Produto: ${item.produto_id || 'N/A'}`);
        console.log(`      Quantidade: ${item.quantidade || 0}`);
        console.log(`      Preço: R$ ${item.preco?.toFixed(2) || '0.00'}`);
      });
    }
    console.log('\n');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Estatísticas
  const statusCount = pedidos.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 ESTATÍSTICAS:');
  console.log(`Total de Pedidos: ${pedidos.length}`);
  console.log(`\nPor Status:`);
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });

  const valorTotal = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  console.log(`\nValor Total de Todos os Pedidos: R$ ${valorTotal.toFixed(2)}`);
  console.log('\n🔍 ========================================\n');

} catch (error) {
  console.error('❌ Erro ao buscar pedidos:', error.message);
  process.exit(1);
}
