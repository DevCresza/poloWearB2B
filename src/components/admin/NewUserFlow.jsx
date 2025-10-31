import React, { useState } from 'react';
import { PendingUser } from '@/api/entities';
import { User } from '@/api/entities';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';
import UserTypeSelector from './UserTypeSelector';
import UserFormMultimarca from './UserFormMultimarca';
import UserFormFornecedor from './UserFormFornecedor';
import UserFormAdmin from './UserFormAdmin';

export default function NewUserFlow({ onSuccess, onCancel }) {
  const [step, setStep] = useState('type'); // 'type', 'form', 'success'
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleUserSubmit = async (userData) => {
    setLoading(true);
    try {
      // Adicionar dados de controle
      const completeUserData = {
        ...userData,
        status: 'pendente'
        // created_at é gerado automaticamente pelo banco
      };

      // Remover campos UUID vazios (PostgreSQL não aceita string vazia em UUID)
      if (!completeUserData.fornecedor_id) {
        delete completeUserData.fornecedor_id;
      }
      if (!completeUserData.contact_id) {
        delete completeUserData.contact_id;
      }
      if (!completeUserData.approved_by) {
        delete completeUserData.approved_by;
      }

      // Criar usuário pendente
      await PendingUser.create(completeUserData);
      
      setStep('success');

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Ocorreu um erro desconhecido.';
      alert(`Falha ao criar usuário: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
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
      <div className="max-w-2xl mx-auto">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">
            <div className="space-y-4">
              <p><strong>Usuário criado com sucesso!</strong></p>
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <p className="font-semibold mb-2">O que acontece agora:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>O usuário foi registrado no sistema</li>
                  <li>As credenciais de acesso foram geradas</li>
                  <li>Um email com as instruções de login será enviado</li>
                  <li>O usuário pode fazer login imediatamente</li>
                </ol>
              </div>
              <p className="text-sm">
                O usuário agora tem acesso completo ao sistema de acordo com seu perfil.
              </p>
            </div>
          </AlertDescription>
        </Alert>
        <div className="mt-6 text-center">
          <button 
            onClick={onSuccess}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Voltar à Lista
          </button>
        </div>
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