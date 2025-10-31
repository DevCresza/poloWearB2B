import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  'src/utils/exportUtils.js',
  'src/pages/UserManagement.jsx',
  'src/pages/PedidosFornecedor.jsx',
  'src/pages/PedidosAdmin.jsx',
  'src/pages/MeusPedidos.jsx',
  'src/pages/MeuPerfil.jsx',
  'src/pages/Layout.jsx',
  'src/pages/HistoricoCompras.jsx',
  'src/pages/GestaoProdutos.jsx',
  'src/pages/GestaoMetas.jsx',
  'src/pages/GestaoFornecedores.jsx',
  'src/pages/GestaoClientes.jsx',
  'src/pages/GestaoCapsulas.jsx',
  'src/pages/GestaoEstoque.jsx',
  'src/pages/Recursos.jsx',
  'src/pages/DashboardAdmin.jsx',
  'src/pages/CrmDashboard.jsx',
  'src/pages/ConfigWhatsApp.jsx',
  'src/pages/CarteiraFinanceira.jsx',
  'src/pages/Carrinho.jsx',
  'src/pages/Catalogo.jsx',
  'src/pages/CadastroCompra.jsx',
  'src/components/recursos/RecursoForm.jsx',
  'src/components/recursos/RecursoDetailsModal.jsx',
  'src/components/pedidos/PedidoEditModal.jsx',
  'src/components/pedidos/PedidoDetailsModal.jsx',
  'src/components/ImageEditor.jsx',
  'src/components/estoque/MovimentacaoEstoqueForm.jsx',
  'src/components/crm/ContactDetailsModal.jsx',
  'src/components/AvatarEditor.jsx',
  'src/components/admin/UserFormFornecedor.jsx',
  'src/components/admin/UserCreationWizard.jsx',
  'src/components/admin/ProductVariantsManager.jsx',
  'src/components/admin/ProductForm.jsx',
  'src/components/admin/PendingUserDetails.jsx',
  'src/components/admin/NewUserForm.jsx',
  'src/components/admin/NewUserFlow.jsx',
  'src/components/admin/ImageUploader.jsx',
  'src/components/admin/FornecedorForm.jsx',
  'src/components/admin/ClientForm.jsx',
  'src/components/admin/CapsulaForm.jsx'
];

const rootDir = path.join(__dirname, '..');

files.forEach(file => {
  const filePath = path.join(rootDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Arquivo não encontrado: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Adicionar import do toast se não existir
  if (!content.includes("import { toast } from")) {
    const importMatch = content.match(/^(import .*?;\n)+/m);
    if (importMatch) {
      const lastImport = importMatch[0];
      content = content.replace(lastImport, lastImport + "import { toast } from 'sonner';\n");
    } else {
      // Se não houver imports, adicionar no início
      content = "import { toast } from 'sonner';\n" + content;
    }
  }

  // Substituir alerts por toasts
  // alert('Sucesso...') ou alert('...sucesso...') -> toast.success()
  content = content.replace(/alert\(['"`]([^'"`]*(?:sucesso|criado|atualizado|salvo|enviado|excluído|deletado|removido|aprovado|concluído)[^'"`]*)['"` ]/gi,
    (match, msg) => `toast.success('${msg}')`);

  // alert('Erro...') ou alert('...erro...') -> toast.error()
  content = content.replace(/alert\(['"`]([^'"`]*(?:erro|falha|inválido|obrigatório|necessário|não encontrado)[^'"`]*)['"` ]/gi,
    (match, msg) => `toast.error('${msg}')`);

  // Outros alerts genéricos -> toast.info()
  content = content.replace(/alert\(['"`]([^'"`]+)['"` ]/g,
    (match, msg) => `toast.info('${msg}')`);

  // Escrever arquivo se houve mudanças
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}`);
  } else {
    console.log(`⏭️  ${file} (sem alterações)`);
  }
});

console.log('\n✨ Substituição concluída!');
