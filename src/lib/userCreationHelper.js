// Helper para criação de usuários pelo admin
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { UserTable } from '@/api/supabaseEntities';
import { Fornecedor } from '@/api/entities';
import { SendEmail } from '@/api/integrations';

/**
 * Gera uma senha aleatória segura
 * @param {number} length - Tamanho da senha (padrão: 12)
 * @returns {string} - Senha gerada
 */
export function generateSecurePassword(length = 12) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%&*';

  const allChars = lowercase + uppercase + numbers + symbols;

  let password = '';

  // Garantir pelo menos um de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Preencher o resto
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Embaralhar
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Cria um novo usuário com acesso completo ao sistema
 * @param {Object} userData - Dados do usuário
 * @returns {Promise<{success: boolean, user?: Object, password?: string, error?: string}>}
 */
export async function createUserWithAccess(userData) {
  try {
    // 1. Gerar senha segura
    const password = generateSecurePassword(12);

    // 2. Criar usuário no Supabase Auth usando signUp
    let authUserId = null;
    if (isSupabaseConfigured()) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: userData.email,
          password: password,
          options: {
            data: {
              full_name: userData.full_name,
              role: userData.role || 'user',
              tipo_negocio: userData.tipo_negocio
            },
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (signUpError) {
          throw new Error(`Erro ao criar autenticação: ${signUpError.message}`);
        }

        authUserId = signUpData.user?.id;
      } catch (authError) {
        throw authError;
      }
    }

    // 3. Preparar dados do usuário para a tabela users
    const completeUserData = {
      id: authUserId, // Usar o ID do Auth
      email: userData.email,
      full_name: userData.full_name,
      telefone: userData.telefone || null,
      tipo_negocio: userData.tipo_negocio,
      role: userData.role || userData.tipo_negocio, // role: usar o enviado ou tipo_negocio (admin, fornecedor, multimarca, franqueado)
      categoria_cliente: userData.categoria_cliente || 'multimarca',
      empresa: userData.nome_empresa || null,
      cnpj: userData.cnpj || null,
      cidade: userData.cidade || null,
      estado: userData.estado || null,
      endereco_completo: userData.endereco || null,
      cep: userData.cep || null,
      ativo: true,
      permissoes: userData.permissoes || getDefaultPermissions(userData.tipo_negocio),
      observacoes: userData.observacoes || null,
      // Adicionar fornecedor_id se for usuário do tipo fornecedor
      fornecedor_id: userData.tipo_negocio === 'fornecedor' ? userData.fornecedor_id : null
      // created_at é gerado automaticamente pelo banco
    };

    // 4. Remover campos null/undefined
    Object.keys(completeUserData).forEach(key => {
      if (completeUserData[key] === undefined) {
        delete completeUserData[key];
      }
    });

    // 5. Criar registro na tabela users
    let createdUser;
    try {
      createdUser = await UserTable.create(completeUserData);
    } catch (dbError) {

      // Se criou no Auth mas falhou no DB, tentar deletar do Auth
      if (isSupabaseConfigured() && authUserId) {
        try {
          // Como não temos admin API, fazer logout
          await supabase.auth.signOut();
        } catch (cleanupError) {
        }
      }

      throw new Error(`Erro ao criar usuário no banco: ${dbError.message}`);
    }

    // 6. Se for fornecedor, atualizar o fornecedor com responsavel_user_id
    if (userData.tipo_negocio === 'fornecedor' && userData.fornecedor_id && createdUser?.id) {
      try {
        await Fornecedor.update(userData.fornecedor_id, {
          responsavel_user_id: createdUser.id
        });
      } catch (fornecedorError) {
        console.error('Erro ao atualizar fornecedor com responsavel_user_id:', fornecedorError);
        // Não falhar a criação do usuário por isso
      }
    }

    // 7. Enviar email com credenciais
    try {
      await sendWelcomeEmail(createdUser, password);
    } catch (emailError) {
      // Não falhar se o email não enviar
    }

    return {
      success: true,
      user: createdUser,
      password: password // Retornar para exibir na tela também
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao criar usuário'
    };
  }
}

/**
 * Envia email de boas-vindas com credenciais
 * @param {Object} user - Usuário criado
 * @param {string} password - Senha gerada
 */
async function sendWelcomeEmail(user, password) {
  const roleNames = {
    admin: 'Administrador',
    user: 'Usuário'
  };

  const tipoNegocioNames = {
    multimarca: 'Franqueado/Multimarca',
    fornecedor: 'Fornecedor',
    admin: 'Administrador'
  };

  const subject = '🎉 Bem-vindo ao Portal B2B POLO Wear!';

  const body = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
    .credential-item { margin: 10px 0; }
    .credential-label { font-weight: bold; color: #667eea; }
    .credential-value { background: #f0f0f0; padding: 8px 12px; border-radius: 4px; font-family: monospace; display: inline-block; margin-left: 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Bem-vindo ao Portal B2B POLO Wear!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${user.full_name}</strong>,</p>

      <p>Seu acesso ao Portal B2B da POLO Wear foi criado com sucesso!</p>

      <div class="credentials">
        <h3>📋 Suas Credenciais de Acesso</h3>
        <div class="credential-item">
          <span class="credential-label">Email:</span>
          <span class="credential-value">${user.email}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Senha:</span>
          <span class="credential-value">${password}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Perfil:</span>
          <span class="credential-value">${tipoNegocioNames[user.tipo_negocio] || user.tipo_negocio}</span>
        </div>
        <div class="credential-item">
          <span class="credential-label">Nível:</span>
          <span class="credential-value">${roleNames[user.role] || user.role}</span>
        </div>
      </div>

      <div class="warning">
        <strong>⚠️ Importante:</strong> Por segurança, recomendamos que você altere sua senha no primeiro acesso. Guarde suas credenciais em local seguro.
      </div>

      <p style="text-align: center;">
        <a href="${window.location.origin}" class="button">🚀 Acessar o Portal</a>
      </p>

      <h3>✨ O que você pode fazer no portal:</h3>
      <ul>
        ${user.tipo_negocio === 'multimarca' ? `
          <li>📦 Explorar nosso catálogo completo de produtos</li>
          <li>🛒 Fazer pedidos diretamente pelo portal</li>
          <li>📊 Acompanhar seus pedidos em tempo real</li>
          <li>💰 Gerenciar sua carteira financeira</li>
          <li>📚 Acessar recursos e treinamentos exclusivos</li>
        ` : ''}
        ${user.tipo_negocio === 'fornecedor' ? `
          <li>📦 Gerenciar seus produtos</li>
          <li>📋 Acompanhar pedidos dos clientes</li>
          <li>📊 Controlar seu estoque</li>
          <li>💼 Visualizar relatórios de vendas</li>
        ` : ''}
        ${user.role === 'admin' ? `
          <li>👥 Gerenciar usuários e permissões</li>
          <li>📊 Acessar dashboards administrativos</li>
          <li>⚙️ Configurar o sistema</li>
          <li>📈 Visualizar relatórios completos</li>
        ` : ''}
      </ul>

      <p>Se tiver qualquer dúvida ou precisar de ajuda, entre em contato com nossa equipe.</p>

      <p>Atenciosamente,<br><strong>Equipe POLO Wear</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático, por favor não responda.</p>
      <p>&copy; ${new Date().getFullYear()} POLO Wear - Todos os direitos reservados</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await SendEmail({
    to: user.email,
    subject: subject,
    body: body
  });
}

/**
 * Retorna permissões padrão baseadas no tipo de negócio
 * @param {string} tipoNegocio - Tipo de negócio do usuário
 * @returns {Object} - Objeto de permissões
 */
function getDefaultPermissions(tipoNegocio) {
  if (tipoNegocio === 'multimarca') {
    return {
      ver_capsulas: true,
      ver_pronta_entrega: true,
      ver_programacao: true,
      ver_relatorios: false,
      ver_precos_custo: false,
      fazer_pedidos: true,
      ver_historico: true
    };
  }

  if (tipoNegocio === 'fornecedor') {
    return {
      gerenciar_produtos: true,
      ver_pedidos: true,
      gerenciar_estoque: true,
      ver_relatorios: true,
      aprovar_pedidos: true
    };
  }

  if (tipoNegocio === 'admin') {
    return {
      gerenciar_usuarios: true,
      gerenciar_produtos: true,
      gerenciar_pedidos: true,
      gerenciar_fornecedores: true,
      ver_relatorios: true,
      configuracoes_sistema: true
    };
  }

  return {};
}
