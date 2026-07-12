import { Navigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { can, PERMISSAO_POR_PAGINA } from '@/utils/permissoes';
import { LABELS_PAPEL, getPapel } from '@/utils/roles';

/**
 * Guarda de rota unica.
 *
 * Antes cada pagina se protegia sozinha — e 7 paginas de admin (DashboardAdmin,
 * GestaoClientes, GestaoFornecedores, GestaoMetas, CrmDashboard, ConfigWhatsApp,
 * Admin) nao tinham guarda nenhuma: bastava um cliente logado digitar a URL.
 */
export default function ProtectedRoute({ pagina, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/Login" replace />;
  }

  const permissao = PERMISSAO_POR_PAGINA[pagina];
  if (permissao && !can(user, permissao)) {
    return <AcessoNegado user={user} />;
  }

  return children;
}

function AcessoNegado({ user }) {
  const papel = getPapel(user);
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Acesso restrito</h1>
        <p className="text-gray-600 mb-1">
          Seu perfil ({LABELS_PAPEL[papel] || papel || 'sem perfil'}) não tem acesso a esta página.
        </p>
        <p className="text-sm text-gray-500">
          Se você precisa deste acesso, fale com um administrador.
        </p>
      </div>
    </div>
  );
}
