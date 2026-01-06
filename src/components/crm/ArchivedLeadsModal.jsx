import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Contact } from '@/api/entities';
import { Archive, Download, Search, Calendar, User, Building, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import ArchivedLeadDetailsModal from './ArchivedLeadDetailsModal';

/**
 * Modal para visualizar e gerenciar leads arquivados
 * Inclui filtros, busca, exportação e visualização detalhada
 */
export default function ArchivedLeadsModal({ open, onClose, onExport }) {
  const [archivedLeads, setArchivedLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (open) {
      loadArchivedLeads();
    }
  }, [open]);

  const loadArchivedLeads = async () => {
    setLoading(true);
    try {
      // Busca contatos arquivados
      const result = await Contact.list({
        filters: { arquivado: true },
        sort: { field: 'data_arquivamento', order: 'desc' }
      });

      setArchivedLeads(result || []);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      convertido: { label: 'Convertido', color: 'bg-green-100 text-green-800' },
      cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const filteredLeads = archivedLeads.filter(lead => {
    const matchesSearch = !searchTerm ||
      lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.empresa?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lead.status_final === statusFilter;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const now = new Date();
      const leadDate = new Date(lead.data_arquivamento);

      switch (dateFilter) {
        case '7_dias':
          matchesDate = (now - leadDate) <= 7 * 24 * 60 * 60 * 1000;
          break;
        case '30_dias':
          matchesDate = (now - leadDate) <= 30 * 24 * 60 * 60 * 1000;
          break;
        case '90_dias':
          matchesDate = (now - leadDate) <= 90 * 24 * 60 * 60 * 1000;
          break;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleViewDetails = (lead) => {
    setSelectedLead(lead);
    setShowDetailsModal(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Leads Arquivados
          </DialogTitle>
          <DialogDescription>
            Visualize e gerencie todos os leads que foram arquivados do sistema
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex gap-4 items-center py-4 border-b">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status final" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="convertido">Convertidos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Períodos</SelectItem>
              <SelectItem value="7_dias">Últimos 7 dias</SelectItem>
              <SelectItem value="30_dias">Últimos 30 dias</SelectItem>
              <SelectItem value="90_dias">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onExport?.('csv')}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => onExport?.('pdf')}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status Final</TableHead>
                  <TableHead>Data Arquivamento</TableHead>
                  <TableHead>Arquivado Por</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {archivedLeads.length === 0 ? 'Nenhum lead arquivado encontrado' : 'Nenhum lead corresponde aos filtros aplicados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {lead.nome}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          {lead.empresa || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>{getStatusBadge(lead.status_final)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(lead.data_arquivamento)}
                        </div>
                      </TableCell>
                      <TableCell>{lead.arquivado_por}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(lead)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {filteredLeads.length} de {archivedLeads.length} leads arquivados
          </div>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>

      <ArchivedLeadDetailsModal
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
      />
    </Dialog>
  );
}
