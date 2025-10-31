import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PendingUser } from '@/api/entities';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  User, Building, MapPin, Phone, Mail, Shield, Settings, 
  Copy, ExternalLink, CheckCircle, Clock, UserCheck, Trash2
} from 'lucide-react';

export default function PendingUserDetails({ pendingUser, onClose, onUpdate, fornecedorMap }) {
  const [updating, setUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      await PendingUser.update(pendingUser.id, { status: newStatus });
      toast.success('Status atualizado para: ${newStatus}');
      onUpdate();
      onClose();
    } catch (error) {
      toast.error('Falha ao atualizar status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Tem certeza que deseja excluir este usuário pendente?')) {
      try {
        await PendingUser.delete(pendingUser.id);
        toast.success('Usuário pendente excluído com sucesso.');
        onUpdate();
        onClose();
      } catch (error) {
        toast.error('Falha ao excluir usuário.');
      }
    }
  };

  const copyDetailedInfo = () => {
    const fornecedorNome = fornecedorMap?.get(pendingUser.fornecedor_id) || 'N/A';
    
    const inviteText = `DETALHES PARA CONVITE - POLO WEAR B2B

=== DADOS BÁSICOS ===
Nome: ${pendingUser.full_name}
Email: ${pendingUser.email}
Telefone: ${pendingUser.telefone || 'Não informado'}
Função: ${pendingUser.role === 'admin' ? 'Administrador' : 'Usuário'}
Tipo: ${pendingUser.tipo_negocio === 'multimarca'
  ? (pendingUser.categoria_cliente === 'franqueado' ? 'Franqueado' : 'Multimarca')
  : pendingUser.tipo_negocio === 'fornecedor' ? 'Fornecedor' : 'Admin'}

=== DADOS DA EMPRESA ===
${pendingUser.nome_empresa ? `Empresa: ${pendingUser.nome_empresa}` : ''}
${pendingUser.cnpj ? `CNPJ: ${pendingUser.cnpj}` : ''}
${pendingUser.endereco ? `Endereço: ${pendingUser.endereco}` : ''}
${pendingUser.cidade && pendingUser.estado ? `Local: ${pendingUser.cidade}/${pendingUser.estado}` : ''}
${pendingUser.cep ? `CEP: ${pendingUser.cep}` : ''}

=== INFORMAÇÕES DO SISTEMA ===
${pendingUser.tipo_negocio === 'fornecedor' ? `Fornecedor: ${fornecedorNome}` : ''}
Senha Temporária: ${pendingUser.password_temporaria}
${pendingUser.observacoes ? `Observações: ${pendingUser.observacoes}` : ''}

=== PERMISSÕES ATIVAS ===
${Object.entries(pendingUser.permissoes || {})
  .filter(([_, value]) => value)
  .map(([key, _]) => `• ${key.replace(/_/g, ' ')}`)
  .join('\n')}

PRÓXIMO PASSO: Revisar e aprovar usuário`;

    navigator.clipboard.writeText(inviteText);
    
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 max-w-sm';
    toast.innerHTML = '<strong>Copiado!</strong><br>Informações completas copiadas para área de transferência.';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 4000);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pendente: { label: 'Aguardando Convite', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      convidado: { label: 'Convite Enviado', color: 'bg-blue-100 text-blue-800', icon: UserCheck },
      ativo: { label: 'Ativo', color: 'bg-green-100 text-green-800', icon: CheckCircle }
    };
    const info = statusMap[status] || statusMap.pendente;
    return (
      <Badge className={info.color}>
        <info.icon className="w-3 h-3 mr-1" />
        {info.label}
      </Badge>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Detalhes: {pendingUser.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status e Ações Rápidas */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Status Atual:</p>
              {getStatusBadge(pendingUser.status)}
            </div>
            <div className="flex gap-2">
              <Button onClick={copyDetailedInfo} variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                Copiar Tudo
              </Button>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Informações do Usuário</strong>
              <p className="mt-2 text-sm">
                Revise os dados abaixo e confirme se todas as informações estão corretas antes de aprovar o acesso do usuário ao sistema.
              </p>
            </AlertDescription>
          </Alert>

          {/* Informações Detalhadas */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Dados Pessoais */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dados Pessoais
                </h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Nome:</strong> {pendingUser.full_name}</div>
                  <div><strong>Email:</strong> {pendingUser.email}</div>
                  <div><strong>Telefone:</strong> {pendingUser.telefone || 'Não informado'}</div>
                  <div><strong>Função:</strong> {pendingUser.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                  <div><strong>Tipo:</strong> {
                    pendingUser.tipo_negocio === 'multimarca'
                      ? (pendingUser.categoria_cliente === 'franqueado' ? 'Franqueado' : 'Multimarca')
                      : pendingUser.tipo_negocio === 'fornecedor' ? 'Fornecedor' : 'Admin'
                  }</div>
                  <div><strong>Senha Temp:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{pendingUser.password_temporaria}</code></div>
                </div>
              </CardContent>
            </Card>

            {/* Dados da Empresa */}
            {(pendingUser.nome_empresa || pendingUser.cnpj || pendingUser.endereco) && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Dados da Empresa
                  </h4>
                  <div className="space-y-2 text-sm">
                    {pendingUser.nome_empresa && <div><strong>Empresa:</strong> {pendingUser.nome_empresa}</div>}
                    {pendingUser.cnpj && <div><strong>CNPJ:</strong> {pendingUser.cnpj}</div>}
                    {pendingUser.endereco && <div><strong>Endereço:</strong> {pendingUser.endereco}</div>}
                    {(pendingUser.cidade || pendingUser.estado) && (
                      <div><strong>Local:</strong> {pendingUser.cidade}/{pendingUser.estado}</div>
                    )}
                    {pendingUser.cep && <div><strong>CEP:</strong> {pendingUser.cep}</div>}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Fornecedor Associado */}
          {pendingUser.tipo_negocio === 'fornecedor' && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4" />
                  Fornecedor Associado
                </h4>
                <p className="text-sm">
                  <strong>Marca:</strong> {fornecedorMap?.get(pendingUser.fornecedor_id) || 'Fornecedor não encontrado'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Permissões */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4" />
                Permissões Definidas
              </h4>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(pendingUser.permissoes || {}).map(([permission, value]) => (
                  <div key={permission} className="text-sm">
                    <span className={value ? 'text-green-600' : 'text-gray-400'}>
                      {value ? '✓' : '✗'} {permission.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          {pendingUser.observacoes && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">Observações</h4>
                <p className="text-sm bg-gray-50 p-3 rounded">{pendingUser.observacoes}</p>
              </CardContent>
            </Card>
          )}

          {/* Ações */}
          <div className="flex justify-between pt-4 border-t">
            <Button onClick={handleDelete} variant="destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
            <div className="flex gap-2">
              {pendingUser.status === 'pendente' && (
                <Button 
                  onClick={() => handleStatusUpdate('convidado')} 
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Marcar como Convidado
                </Button>
              )}
              <Button onClick={onClose} variant="outline">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}