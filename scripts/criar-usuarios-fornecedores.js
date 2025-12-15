// Script para criar usuários de login para fornecedores existentes
// Execute com: node scripts/criar-usuarios-fornecedores.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  console.error('   Necessário: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Senha padrão para todos os fornecedores (mínimo 6 caracteres exigido pelo Supabase)
const SENHA_PADRAO = "Polo@2024";

// Fornecedores que precisam de usuário
const fornecedores = [
  { id: "23a93ac0-31ea-47a1-8765-3ca6e866b32f", email: "CLCALVESCONFECCOES@GMAIL.COM", nome: "CLC ALVES CONFECCOES LTDA", marca: "Polo Wear" },
  { id: "bf1803eb-5f27-4585-aa68-0e4a6b73f39b", email: "comercial@zotto.com.br", nome: "Zotto Calcados LTDA", marca: "Polo Wear" },
  { id: "836212cf-02e8-4169-9a0e-456cd71acead", email: "washington@massaricintos.com.br", nome: "MASSARI CINTOS LTDA", marca: "Polo Wear" },
  { id: "68b37169-d071-499f-9496-ef1a2f10a7be", email: "ADM@ARTLIVREMODAS.COM.BR", nome: "ART LIVRE MODAS", marca: "Polo Wear" },
  { id: "112094d2-9416-418e-b64e-a83654923ae6", email: "DESENVOLVIMENTO.MX72@GMAIL.COM", nome: "MX72 MANUFATURA DA MODA LTDA", marca: "Polo Wear" },
  { id: "bd4a1ae1-3fa8-4b3d-bdbc-740820ab16c5", email: "RESERVABRASILEIRA2016@GMAIL.COM", nome: "RESERVA BRASILEIRA INDUSTRIA E COMERCIO LTDA", marca: "Polo Wear" },
  { id: "0ef0e90f-e0a8-4b4a-9424-400b91aa87c1", email: "ENEWSIDE@GMAIL.COM", nome: "JA GUIRRO COMERCIO DE CONFECCOES LTDA", marca: "Polo Wear" },
  { id: "89cd2c40-739b-4978-8b09-10e6f2271438", email: "COMERCIAL@ANDRIETTI.COM.BR", nome: "ANDRIETTI CONFECCOES EIRELI", marca: "Polo Wear" },
  { id: "a7eb17a4-820d-4920-b6d2-7495e8eef684", email: "GGERIOS@UOL.COM.BR", nome: "HAPUNA CONFECCOES E COMERCIO LTDA", marca: "Polo Wear" },
  { id: "dcf612c7-8a2b-4511-835a-b9cbf0865add", email: "ALE.OREPRESENTANTE@GMAIL.COM", nome: "VENTURY INDUSTRIA E COMERCIO DE CONFECCOES LTDA", marca: "Polo Wear" },
  { id: "ed92b716-071c-4753-9579-2616b90c9343", email: "JOAOLUIZ@ALTOMAX.COM.BR", nome: "ALTOMAX COMERCIO DE MEIAS E COBERTORES", marca: "Polo Wear" },
  { id: "fa0db94e-565e-4971-a64c-10d5a01e0e35", email: "EDUARDOKUCHKARIAN@YAHOO.COM.BR", nome: "BLUE BAY COMERCIAL LTDA", marca: "Polo Wear" },
  { id: "9fcf7d80-49b9-4ca8-996a-1cba8637eccd", email: "STIR@STIR.COM.BR", nome: "INDUSTRIA DE CALCADOS PLUMA LTDA", marca: "Polo Wear" },
  { id: "eb4afeef-2a19-4e55-8b6b-3d4bdd447a38", email: "NFE@ABBATEXTIL.COM.BR", nome: "ABBA CONFECCOES LTDA", marca: "Polo Wear" },
  { id: "1e322c93-11b9-4983-bd85-7359c2fd15b9", email: "FOUADMATTAR@UOL.COM.BR", nome: "J SHAYEB E CIA LTDA", marca: "Polo Wear" },
  { id: "d880d7d1-deda-4870-9dab-14518c7da012", email: "KASDCONTABIL@KASDCONTABIL.COM.BR", nome: "YUNIK COMERCIAL IMPORTADORA", marca: "Polo Wear" },
  { id: "0aa99639-6935-4b25-96a5-3215f2d186d8", email: "MIGUEL@MGMCOM.COM.BR", nome: "MGM COMERCIO DE ACESSORIOS DE MODA LTDA", marca: "Polo Wear" },
  { id: "1f5c6be6-e705-4252-9dd0-efdeca953f27", email: "THAIANE.DIFERENTT@GMAIL.COM", nome: "CONFECCOES DE ROUPAS DIFERENTT LTDA", marca: "Polo Wear" },
  { id: "f3b81302-2d86-444c-8cb7-6c6511807b07", email: "KAZUZA@KAZUZA.COM.BR", nome: "VELLUTI IND E COM DE CALCADOS E ACESSORIOS LTDA", marca: "Polo Wear" },
];

async function criarUsuarios() {
  console.log('🚀 Iniciando criação de usuários para fornecedores...\n');

  const emailsProcessados = new Set();
  let criados = 0;
  let erros = 0;
  let duplicados = 0;

  for (const fornecedor of fornecedores) {
    const emailLower = fornecedor.email.toLowerCase();

    // Evitar duplicatas de email
    if (emailsProcessados.has(emailLower)) {
      console.log(`⏭️  Pulando ${fornecedor.email} (email duplicado)`);
      duplicados++;
      continue;
    }
    emailsProcessados.add(emailLower);

    try {
      console.log(`📝 Criando usuário: ${fornecedor.email}`);

      // Verificar se usuário já existe
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('email', fornecedor.email)
        .single();

      if (existingUser) {
        console.log(`   ⏭️  Usuário já existe, pulando...`);
        duplicados++;
        continue;
      }

      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: fornecedor.email.toLowerCase(),
        password: SENHA_PADRAO,
        options: {
          data: {
            full_name: fornecedor.nome,
            role: 'fornecedor',
            tipo_negocio: 'fornecedor'
          }
        }
      });

      if (authError) {
        // Se o erro for de usuário já existente no Auth, tentar criar apenas na tabela users
        if (authError.message.includes('already registered')) {
          console.log(`   ⚠️  Email já registrado no Auth`);
          duplicados++;
          continue;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Usuário não foi criado no Auth');
      }

      console.log(`   ✅ Auth criado: ${authData.user.id}`);

      // Criar/Atualizar registro na tabela users
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: fornecedor.email.toLowerCase(),
          full_name: fornecedor.nome,
          role: 'fornecedor',
          tipo_negocio: 'fornecedor',
          empresa: fornecedor.marca,
          fornecedor_id: fornecedor.id,
          ativo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (userError) {
        console.error(`   ❌ Erro ao criar registro em users: ${userError.message}`);
        erros++;
        continue;
      }

      console.log(`   ✅ Usuário criado com sucesso!\n`);
      criados++;

    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
      erros++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO:');
  console.log(`   ✅ Criados: ${criados}`);
  console.log(`   ⏭️  Duplicados/Existentes: ${duplicados}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log('='.repeat(50));

  if (criados > 0) {
    console.log('\n✨ Usuários criados podem fazer login com:');
    console.log('   Email: (email cadastrado no fornecedor)');
    console.log('   Senha: (senha cadastrada no fornecedor)');
  }
}

criarUsuarios().catch(console.error);
