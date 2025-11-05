// Script para Listar Todos os Usuários do Sistema
// Execute: node scripts/listar-usuarios.js

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

console.log('👥 ========================================');
console.log('👥 LISTAR USUÁRIOS DO SISTEMA');
console.log('👥 ========================================\n');

try {
  // Buscar todos os usuários da tabela auth.users
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  console.log(`📊 Total de usuários encontrados: ${users.length}\n`);

  if (users.length === 0) {
    console.log('❌ Nenhum usuário encontrado no banco de dados.\n');
    process.exit(0);
  }

  // Exibir cada usuário
  users.forEach((user, index) => {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 USUÁRIO #${index + 1}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${user.id}`);
    console.log(`Nome: ${user.full_name || 'N/A'}`);
    console.log(`Email: ${user.email || 'N/A'}`);
    console.log(`Role: ${user.role || 'N/A'}`);
    console.log(`Tipo de Negócio: ${user.tipo_negocio || 'N/A'}`);
    console.log(`Empresa: ${user.nome_empresa || 'N/A'}`);
    console.log(`Telefone: ${user.telefone || 'N/A'}`);
    console.log(`Cidade/Estado: ${user.cidade && user.estado ? `${user.cidade}/${user.estado}` : 'N/A'}`);
    console.log(`Ativo: ${user.ativo ? '✅ Sim' : '❌ Não'}`);
    console.log(`Bloqueado: ${user.bloqueado ? '🔒 Sim' : '🔓 Não'}`);
    console.log(`Criado em: ${user.created_at || 'N/A'}`);
    console.log('\n');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Estatísticas
  const stats = {
    admins: users.filter(u => u.role === 'admin').length,
    users: users.filter(u => u.role === 'user').length,
    multimarca: users.filter(u => u.tipo_negocio === 'multimarca').length,
    fornecedor: users.filter(u => u.tipo_negocio === 'fornecedor').length,
    ativos: users.filter(u => u.ativo).length,
    bloqueados: users.filter(u => u.bloqueado).length,
  };

  console.log('📊 ESTATÍSTICAS:');
  console.log(`\nPor Role:`);
  console.log(`  - Administradores: ${stats.admins}`);
  console.log(`  - Usuários: ${stats.users}`);
  console.log(`\nPor Tipo de Negócio:`);
  console.log(`  - Multimarca: ${stats.multimarca}`);
  console.log(`  - Fornecedor: ${stats.fornecedor}`);
  console.log(`\nStatus:`);
  console.log(`  - Ativos: ${stats.ativos}`);
  console.log(`  - Bloqueados: ${stats.bloqueados}`);
  console.log('\n👥 ========================================\n');

} catch (error) {
  console.error('❌ Erro ao listar usuários:', error.message);
  process.exit(1);
}
