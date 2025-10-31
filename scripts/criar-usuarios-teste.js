// Script para criar usuários de teste no Supabase
// Execute com: node scripts/criar-usuarios-teste.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const usuarios = [
  {
    id: '441ac0e4-312f-428d-bb14-09823d470361',
    email: 'admin@polo-b2b.com',
    password: 'admin123',
    full_name: 'Administrador POLO',
    role: 'admin',
    tipo_negocio: 'admin',
    telefone: '(11) 99999-9999',
    empresa: 'Polo Wear',
    ativo: true
  },
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'fornecedor@exemplo.com',
    password: 'fornecedor123',
    full_name: 'João Silva Fornecedor',
    role: 'fornecedor',
    tipo_negocio: 'fornecedor',
    telefone: '(11) 98765-4321',
    empresa: 'MX Confecções',
    marca: 'MX',
    cnpj: '11.222.333/0001-44',
    ativo: true
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'cliente@exemplo.com',
    password: 'cliente123',
    full_name: 'Maria Santos Cliente',
    role: 'multimarca',
    tipo_negocio: 'multimarca',
    telefone: '(11) 91234-5678',
    empresa: 'Loja Multimarca ABC',
    razao_social: 'ABC COMERCIO DE ROUPAS LTDA',
    cnpj: '98.765.432/0001-10',
    cidade: 'São Paulo - SP',
    endereco: 'Rua das Flores, 123 - Centro',
    cep: '01234-567',
    possui_loja_fisica: true,
    faixa_faturamento_mensal: 'R$ 50.000 - R$ 100.000',
    limite_credito: 10000.00,
    ativo: true
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'cliente2@exemplo.com',
    password: 'cliente123',
    full_name: 'Carlos Oliveira',
    role: 'multimarca',
    tipo_negocio: 'multimarca',
    telefone: '(21) 98888-7777',
    empresa: 'Boutique Fashion Rio',
    razao_social: 'FASHION RIO COMERCIO LTDA',
    cnpj: '12.345.678/0001-99',
    cidade: 'Rio de Janeiro - RJ',
    possui_loja_fisica: true,
    faixa_faturamento_mensal: 'R$ 100.000 - R$ 500.000',
    limite_credito: 25000.00,
    ativo: true
  }
];

async function criarUsuarios() {
  console.log('🚀 Iniciando criação de usuários de teste...\n');

  for (const usuario of usuarios) {
    const { email, password, ...userData } = usuario;

    try {
      console.log(`📝 Criando usuário: ${email}`);

      // 1. Primeiro, deletar se já existir na tabela users
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', email);

      if (deleteError && deleteError.code !== 'PGRST116') {
        console.warn(`   ⚠️ Aviso ao deletar usuário existente: ${deleteError.message}`);
      }

      // 2. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
          emailRedirectTo: undefined // Não enviar email de confirmação
        }
      });

      if (authError) {
        console.error(`   ❌ Erro no Auth: ${authError.message}`);
        continue;
      }

      if (!authData.user) {
        console.error(`   ❌ Erro: Usuário não foi criado no Auth`);
        continue;
      }

      console.log(`   ✅ Auth criado: ${authData.user.id}`);

      // 3. Atualizar a tabela users com os dados completos
      const { error: updateError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email,
          ...userData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (updateError) {
        console.error(`   ❌ Erro ao atualizar users: ${updateError.message}`);
        continue;
      }

      console.log(`   ✅ Usuário criado com sucesso!\n`);

    } catch (error) {
      console.error(`   ❌ Erro ao criar ${email}:`, error.message);
      console.error(error);
    }
  }

  console.log('\n🎉 Processo concluído!');
  console.log('\n📋 Usuários criados:');
  console.log('  - admin@polo-b2b.com / admin123');
  console.log('  - fornecedor@exemplo.com / fornecedor123');
  console.log('  - cliente@exemplo.com / cliente123');
  console.log('  - cliente2@exemplo.com / cliente123');
}

criarUsuarios().catch(console.error);
