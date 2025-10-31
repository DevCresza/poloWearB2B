
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download, Users } from 'lucide-react';

export default function CrmHeader({ contacts, onSearchChange, onFilterChange, filters, onExportLeads, onExportPDF, searchTerm }) {
  const estados = [
    'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE'
  ];

  const stats = {
    total: contacts.length,
    novos: contacts.filter(c => c.status === 'novo').length,
    emContato: contacts.filter(c => c.status === 'em_contato').length,
    negociacao: contacts.filter(c => c.status === 'negociacao').length,
    convertidos: contacts.filter(c => c.status === 'convertido').length
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Novos</p>
              <p className="text-2xl font-bold text-blue-600">{stats.novos}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Em Contato</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.emContato}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Negociação</p>
              <p className="text-2xl font-bold text-purple-600">{stats.negociacao}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Convertidos</p>
              <p className="text-2xl font-bold text-green-600">{stats.convertidos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col lg:flex-row gap-4 items-center flex-1 w-full">
              {/* Busca */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome, email ou empresa..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtros */}
              <Select 
                value={filters.fonte_lead} 
                onValueChange={(value) => onFilterChange('fonte_lead', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Fonte do Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Fontes</SelectItem>
                  <SelectItem value="Formulário Site">Formulário Site</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Evento">Evento</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.estado} 
                onValueChange={(value) => onFilterChange('estado', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Estados</SelectItem>
                  {estados.map(estado => (
                    <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={onExportPDF} variant="outline" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
              <Button onClick={onExportLeads} variant="outline" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
