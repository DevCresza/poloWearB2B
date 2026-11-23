/**
 * Script para atualizar todos produtos e fornecedores para marca Polo Wear
 */

import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile(); } catch { /* sem .env: usa o ambiente */ }

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function atualizarMarcas() {
  console.log('🔄 Atualizando marcas para Polo Wear...\n');

  try {
    // 1. Atualizar produtos
    console.log('📦 Atualizando produtos...');
    const { data: produtos, error: errorProdutos } = await supabase
      .from('produtos')
      .update({ marca: 'Polo Wear' })
      .neq('marca', 'Polo Wear')
      .select();

    if (errorProdutos) {
      console.error('❌ Erro ao atualizar produtos:', errorProdutos);
    } else {
      console.log(`✅ ${produtos?.length || 0} produtos atualizados para Polo Wear`);
    }

    // 2. Atualizar fornecedores
    console.log('\n🏭 Atualizando fornecedores...');
    const { data: fornecedores, error: errorFornecedores } = await supabase
      .from('fornecedores')
      .update({ nome_marca: 'Polo Wear' })
      .neq('nome_marca', 'Polo Wear')
      .select();

    if (errorFornecedores) {
      console.error('❌ Erro ao atualizar fornecedores:', errorFornecedores);
    } else {
      console.log(`✅ ${fornecedores?.length || 0} fornecedores atualizados para Polo Wear`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Atualização concluída!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Erro durante a atualização:', error);
  }
}

// Executar
atualizarMarcas();
