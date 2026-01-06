import { useState } from 'react';
import { PendingUser } from '@/api/entities';
import { User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, Copy, ArrowLeft, Key, Eye, EyeOff } from 'lucide-react';
import UserTypeSelector from './UserTypeSelector';
import UserFormMultimarca from './UserFormMultimarca';
import UserFormFornecedor from './UserFormFornecedor';
import UserFormAdmin from './UserFormAdmin';
import { createUserWithAccess } from '@/lib/userCreationHelper';
import { toast } from 'sonner';

export default function UserCreationWizard({ onSuccess, onCancel }) {
  const [step, setStep] = useState('type'); // 'type', 'form', 'success'
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleUserSubmit = async (userData) => {
    setLoading(true);
    try {
      // Criar usuário COM ACESSO IMEDIATO ao sistema
      const result = await createUserWithAccess(userData);

      if (!result.success) {
        throw new Error(result.error);
      }

      setCreatedUser(result.user);
      setGeneratedPassword(result.password);
      setStep('success');

    } catch (error) {
      const errorMessage = error.message || 'Ocorreu um erro desconhecido.';
      toast.error(`Falha ao criar usuário: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!createdUser || !generatedPassword) return;

    const credentials = `=== CREDENCIAIS DE ACESSO - POLO WEAR B2B ===

Email: ${createdUser.email}
Senha: ${generatedPassword}

Nome: ${createdUser.full_name}
Tipo: ${createdUser.tipo_negocio}
Função: ${createdUser.role}
${createdUser.empresa ? `Empresa: ${createdUser.empresa}` : ''}

Portal: ${window.location.origin}

⚠️ IMPORTANTE: Guarde estas credenciais em local seguro!`;

    navigator.clipboard.writeText(credentials);

    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
    toast.textContent = '✅ Credenciais copiadas para área de transferência!';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  };

  const renderForm = () => {
    const props = {
      onSubmit: handleUserSubmit,
      onCancel: () => setStep('type'),
      loading
    };

    switch (selectedType) {
      case 'multimarca':
        return <UserFormMultimarca {...props} />;
      case 'fornecedor':
        return <UserFormFornecedor {...props} />;
      case 'admin':
        return <UserFormAdmin {...props} />;
      default:
        return null;
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-6 h-6" />
              ✅ Usuário Criado com Sucesso!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-white border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-4">
                  <p className="font-semibold text-green-800">
                    🎉 O usuário foi criado e já pode fazer login no sistema!
                  </p>
                  <p className="text-sm text-green-700">
                    Um email com as credenciais de acesso foi enviado automaticamente para <strong>{createdUser?.email}</strong>
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Credenciais Geradas */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-blue-900 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Credenciais de Acesso
                </h3>
                <Button
                  onClick={() => setShowPassword(!showPassword)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>

              <div className="space-y-3 bg-white p-4 rounded-lg border border-blue-200">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Email:</p>
                  <p className="text-lg font-mono bg-gray-50 px-3 py-2 rounded border">{createdUser?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Senha:</p>
                  <p className="text-lg font-mono bg-gray-50 px-3 py-2 rounded border">
                    {showPassword ? generatedPassword : '••••••••••••'}
                  </p>
                </div>
              </div>

              <Alert className="mt-4 bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-800 text-sm">
                  ⚠️ <strong>Importante:</strong> Guarde estas credenciais em local seguro! O usuário deverá alterar a senha no primeiro acesso.
                </AlertDescription>
              </Alert>
            </div>

            {/* Informações do Usuário */}
            {createdUser && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="font-semibold mb-3 text-gray-800">📋 Informações do Usuário:</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Nome:</p>
                    <p className="font-semibold">{createdUser.full_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email:</p>
                    <p className="font-semibold">{createdUser.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Tipo de Negócio:</p>
                    <p className="font-semibold capitalize">{createdUser.tipo_negocio}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Nível de Acesso:</p>
                    <p className="font-semibold capitalize">{createdUser.role}</p>
                  </div>
                  {createdUser.empresa && (
                    <div className="col-span-2">
                      <p className="text-gray-600">Empresa:</p>
                      <p className="font-semibold">{createdUser.empresa}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex justify-center gap-4">
              <Button onClick={copyCredentials} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Copiar Credenciais
              </Button>
              <Button onClick={onSuccess} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar à Lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {step === 'type' && (
        <UserTypeSelector onSelect={handleTypeSelect} />
      )}
      {step === 'form' && renderForm()}
    </div>
  );
}