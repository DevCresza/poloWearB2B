// Script para Verificar Estrutura da Tabela Users
// Execute: node scripts/verificar-estrutura-users.js

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
console.log('🔍 ESTRUTURA DA TABELA USERS');
console.log('🔍 ========================================\n');

try {
  // Consulta SQL para obter a estrutura da tabela
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    // Se a função RPC não existir, tentar abordagem alternativa
    console.log('⚠️  Tentando método alternativo...\n');

    // Pegar um usuário de exemplo para ver os campos
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();

    if (sampleError) throw sampleError;

    console.log('📋 CAMPOS DISPONÍVEIS (baseado em usuário exemplo):\n');
    Object.keys(sampleUser).forEach(field => {
      const value = sampleUser[field];
      const type = typeof value;
      console.log(`  - ${field}: ${type} = ${value !== null ? String(value).substring(0, 50) : 'NULL'}`);
    });

  } else {
    console.log('📋 ESTRUTURA COMPLETA:\n');
    data.forEach(col => {
      const required = col.is_nullable === 'NO' ? '🔴 OBRIGATÓRIO' : '🟢 Opcional';
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Campo: ${col.column_name}`);
      console.log(`Tipo: ${col.data_type}`);
      console.log(`${required}`);
      if (col.column_default) {
        console.log(`Padrão: ${col.column_default}`);
      }
      if (col.character_maximum_length) {
        console.log(`Tamanho máximo: ${col.character_maximum_length}`);
      }
      console.log('');
    });
  }

  console.log('\n🔍 ========================================\n');

} catch (error) {
  console.error('❌ Erro:', error.message);
  console.log('\nℹ️  Tentando buscar informações de um usuário existente...\n');

  try {
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (users && users.length > 0) {
      console.log('📋 CAMPOS DO USUÁRIO:\n');
      Object.keys(users[0]).forEach(key => {
        console.log(`  - ${key}`);
      });
    }
  } catch (e) {
    console.error('❌ Erro ao buscar usuário:', e.message);
  }
}
