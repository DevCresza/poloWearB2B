// Script para Excluir Pedido de Teste do Supabase
// Execute: node scripts/excluir-pedido-teste.js

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
try { process.loadEnvFile(resolve(__dirname, '../.env')); } catch { /* sem .env: usa o ambiente */ }

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const PEDIDO_ID = 'c94caa7c-b13f-4ad5-a12d-bb55eba111e5';

console.log('🗑️  ========================================');
console.log('🗑️  EXCLUIR PEDIDO DE TESTE');
console.log('🗑️  ========================================\n');

try {
  // Buscar o pedido antes de excluir
  console.log(`🔍 Buscando pedido ${PEDIDO_ID}...`);
  const { data: pedido, error: fetchError } = await supabase
    .from('pedidos')
    .select('*')
    .eq('id', PEDIDO_ID)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      console.log('❌ Pedido não encontrado.\n');
      process.exit(0);
    }
    throw fetchError;
  }

  console.log('✅ Pedido encontrado:');
  console.log(`   ID: ${pedido.id}`);
  console.log(`   Status: ${pedido.status}`);
  console.log(`   Valor: R$ ${pedido.valor_total?.toFixed(2)}`);
  console.log(`   Data: ${pedido.created_date}\n`);

  // Excluir o pedido
  console.log('🗑️  Excluindo pedido...');
  const { error: deleteError } = await supabase
    .from('pedidos')
    .delete()
    .eq('id', PEDIDO_ID);

  if (deleteError) throw deleteError;

  console.log('✅ Pedido excluído com sucesso!\n');

  // Verificar se foi excluído
  const { data: verificacao } = await supabase
    .from('pedidos')
    .select('id')
    .eq('id', PEDIDO_ID);

  if (!verificacao || verificacao.length === 0) {
    console.log('✅ Verificação: Pedido não existe mais no banco de dados.\n');
  } else {
    console.log('⚠️  Aviso: Pedido ainda aparece no banco de dados.\n');
  }

  console.log('🗑️  ========================================\n');

} catch (error) {
  console.error('❌ Erro ao excluir pedido:', error.message);
  process.exit(1);
}
