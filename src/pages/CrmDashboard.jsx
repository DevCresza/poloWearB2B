
import { useState, useEffect, useMemo } from 'react';
import { Contact } from '@/api/entities';
import { User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SendEmail } from '@/api/integrations';
import ContactCard from '../components/crm/ContactCard';
import ContactDetailsModal from '../components/crm/ContactDetailsModal';
import WhatsappModal from '../components/crm/WhatsappModal';
import CrmHeader from '../components/crm/CrmHeader';
import { Users, Clock, MessageCircle, CheckCircle, X, Download } from 'lucide-react';
import { exportToCSV, exportToPDF, formatDateTime } from '@/utils/exportUtils';
import { toast } from 'sonner';


export default function CrmDashboard() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ fonte_lead: 'all', estado: 'all' });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const contactsList = await Contact.list({ sort: '-created_at' });
      setContacts(contactsList || []); // Garantir que sempre seja array
    } catch (_error) {
      setContacts([]); // Definir array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const filteredContacts = useMemo(() => {
    let filtered = contacts || [];
    
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filters.fonte_lead !== 'all') {
      filtered = filtered.filter(contact => contact.fonte_lead === filters.fonte_lead);
    }
    
    if (filters.estado !== 'all') {
      filtered = filtered.filter(contact => contact.estado === filters.estado);
    }
    
    return filtered;
  }, [contacts, searchTerm, filters]);

  const handleStatusChange = async (contactId, newStatus) => {
    try {
      await Contact.update(contactId, { 
        status: newStatus,
        ultimo_contato: new Date().toISOString()
      });
      loadContacts();
    } catch (_error) {
    }
  };

  const handleExport = async (format) => {
    try {
      // Preparar dados para exportação
      const exportData = filteredContacts.map(contact => ({
        nome: contact.nome,
        email: contact.email,
        telefone: contact.telefone || '',
        empresa: contact.empresa || '',
        cidade: contact.cidade || '',
        estado: contact.estado || '',
        status: contact.status || 'novo',
        fonte_lead: contact.fonte_lead || '',
        tem_loja_fisica: contact.tem_loja_fisica || '',
        faixa_faturamento: contact.faixa_faturamento || '',
        criado_em: formatDateTime(contact.created_at)
      }));

      // Definir colunas
      const columns = [
        { key: 'nome', label: 'Nome' },
        { key: 'email', label: 'Email' },
        { key: 'telefone', label: 'Telefone' },
        { key: 'empresa', label: 'Empresa' },
        { key: 'cidade', label: 'Cidade' },
        { key: 'estado', label: 'Estado' },
        { key: 'status', label: 'Status' },
        { key: 'fonte_lead', label: 'Fonte' },
        { key: 'tem_loja_fisica', label: 'Loja Física' },
        { key: 'faixa_faturamento', label: 'Faturamento' },
        { key: 'criado_em', label: 'Data Cadastro' }
      ];

      if (format === 'pdf') {
        await exportToPDF(
          exportData,
          columns,
          'Relatório de Leads - CRM Polo Wear',
          `leads_crm_${new Date().toISOString().split('T')[0]}.pdf`
        );
      } else if (format === 'csv') {
        exportToCSV(
          exportData,
          columns,
          `leads_crm_${new Date().toISOString().split('T')[0]}.csv`
        );
      }
    } catch (_error) {
      toast.error('Erro ao exportar dados.');
    }
  };

  const handleCreateUser = async (contact) => {
    if (!confirm(`Tem certeza que deseja converter "${contact.nome}" em um cliente e liberar o acesso ao catálogo?`)) {
      return;
    }

    try {
      // 1. Criar usuário no sistema com permissões básicas
      const userData = {
        email: contact.email,
        full_name: contact.nome,
        nome_empresa: contact.empresa,
        telefone: contact.telefone,
        cidade: contact.cidade,
        estado: contact.estado,
        tipo_negocio: 'multimarca',
        role: 'user',
        total_compras_realizadas: 0,
        permissoes: {
          ver_capsulas: true,
          ver_pronta_entrega: true,
          ver_programacao: true,
          ver_relatorios: false,
          ver_precos_custo: false
        }
      };

      await User.create(userData);

      // 2. Enviar email de boas-vindas com credenciais (simulado)
      await SendEmail({
        to: contact.email,
        subject: 'Bem-vindo ao Portal B2B POLO Wear!',
        body: `Olá ${contact.nome},\n\nSeu acesso ao Portal B2B da POLO Wear foi liberado!\n\nUse seu email (${contact.email}) para fazer o login. Você será solicitado a criar uma senha no primeiro acesso.\n\nAcesse o portal e explore nosso catálogo completo.\n\nAtenciosamente,\nEquipe POLO Wear`
      });

      // 3. Atualizar status do contato para 'convertido'
      await Contact.update(contact.id, { 
        status: 'convertido', // Change status to 'convertido'
        ultimo_contato: new Date().toISOString(),
        observacoes: (contact.observacoes || '') + '\n[Sistema] Usuário criado e email de boas-vindas enviado.'
      });

      toast.success('Cliente criado com sucesso! Um email de boas-vindas foi enviado.');
      loadContacts();

    } catch (_error) {
      toast.error('Erro ao criar cliente. Verifique se o email já não está cadastrado no sistema.');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      novo: 'bg-blue-500',
      em_contato: 'bg-yellow-500',
      negociacao: 'bg-purple-500',
      convertido: 'bg-green-500', // New status color
      finalizado: 'bg-gray-500',  // Changed color
      cancelado: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusIcon = (status) => {
    const icons = {
      novo: Clock,
      em_contato: MessageCircle,
      negociacao: Users,
      convertido: CheckCircle, // New status icon
      finalizado: CheckCircle, // Re-using CheckCircle, or pick another if needed
      cancelado: X
    };
    return icons[status] || Clock;
  };

  const statusColumns = [
    { key: 'novo', title: 'Novos Leads', color: 'border-blue-500' },
    { key: 'em_contato', title: 'Em Contato', color: 'border-yellow-500' },
    { key: 'negociacao', title: 'Em Negociação', color: 'border-purple-500' },
    { key: 'convertido', title: 'Convertidos', color: 'border-green-500' }, // Added column
    { key: 'finalizado', title: 'Finalizados', color: 'border-gray-500' }, // Changed color
    { key: 'cancelado', title: 'Cancelados', color: 'border-red-500' }
  ];

  const handleExportLeads = async () => {
    // Exportar CSV por padrão
    await handleExport('csv');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <CrmHeader
        contacts={contacts}
        onSearchChange={setSearchTerm}
        onFilterChange={handleFilterChange}
        filters={filters}
        onExportLeads={handleExportLeads}
        onExportPDF={() => handleExport('pdf')}
      />

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-4 overflow-x-auto pb-4">
          {statusColumns.map((column) => {
            const columnContacts = (filteredContacts || []).filter(contact => contact.status === column.key);
            
            return (
              <div key={column.key} className={`flex-shrink-0 w-80 border-t-4 ${column.color}`}>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{column.title}</span>
                      <Badge variant="outline">{columnContacts.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {columnContacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        onViewDetails={(contact) => {
                          setSelectedContact(contact);
                          setShowDetailsModal(true);
                        }}
                        onSendWhatsapp={(contact) => {
                          setSelectedContact(contact);
                          setShowWhatsappModal(true);
                        }}
                        onStatusChange={handleStatusChange}
                        onCreateUser={handleCreateUser}
                        getStatusColor={getStatusColor}
                        getStatusIcon={getStatusIcon}
                      />
                    ))}
                    {columnContacts.length === 0 && (
                      <p className="text-gray-500 text-center py-8">
                        Nenhum lead nesta etapa
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showDetailsModal && selectedContact && (
        <ContactDetailsModal
          contact={selectedContact}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedContact(null);
          }}
          onUpdate={() => {
            loadContacts();
            setShowDetailsModal(false);
            setSelectedContact(null);
          }}
        />
      )}

      {showWhatsappModal && selectedContact && (
        <WhatsappModal
          contacts={[selectedContact]}
          onClose={() => {
            setShowWhatsappModal(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  );
}
