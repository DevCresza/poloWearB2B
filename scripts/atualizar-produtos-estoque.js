/**
 * Script para atualizar produtos existentes
 * Garante que todos produtos tenham controla_estoque: true
 */

import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile(); } catch { /* sem .env: usa o ambiente */ }

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis de ambiente não encontradas');
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function atualizarProdutos() {
  console.log('🔄 Iniciando atualização de produtos...\n');

  try {
    // Buscar todos os produtos
    const { data: produtos, error: errorList } = await supabase
      .from('produtos')
      .select('*');

    if (errorList) {
      console.error('❌ Erro ao buscar produtos:', errorList);
      return;
    }

    console.log(`📦 Encontrados ${produtos.length} produtos\n`);

    // Atualizar cada produto
    let atualizados = 0;
    let erros = 0;

    for (const produto of produtos) {
      console.log(`⏳ Atualizando: ${produto.nome}...`);

      const { error: errorUpdate } = await supabase
        .from('produtos')
        .update({
          controla_estoque: true
        })
        .eq('id', produto.id);

      if (errorUpdate) {
        console.error(`  ❌ Erro ao atualizar: ${errorUpdate.message}`);
        erros++;
      } else {
        console.log(`  ✅ Atualizado com sucesso`);
        atualizados++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Atualização concluída!`);
    console.log(`   - ${atualizados} produtos atualizados`);
    if (erros > 0) {
      console.log(`   - ${erros} erros`);
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Erro durante a atualização:', error);
  }
}

// Executar
atualizarProdutos();
