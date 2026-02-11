import { useState, useEffect } from 'react';
import { WhatsappTemplate } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, MessageCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfigWhatsApp() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    assunto: '',
    mensagem: '',
    ativo: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const list = await WhatsappTemplate.list({ sort: '-created_at' });
      setTemplates(list || []);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await WhatsappTemplate.update(editingTemplate.id, formData);
      } else {
        await WhatsappTemplate.create(formData);
      }
      setShowForm(false);
      setEditingTemplate(null);
      setFormData({ nome: '', assunto: '', mensagem: '', ativo: true });
      loadTemplates();
    } catch (_error) {
      toast.error('Erro ao salvar template');
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      nome: template.nome,
      assunto: template.assunto,
      mensagem: template.mensagem,
      ativo: template.ativo
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja realmente excluir este template?')) return;
    try {
      await WhatsappTemplate.delete(id);
      loadTemplates();
    } catch (_error) {
      toast.error('Erro ao excluir template');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.info('Mensagem copiada!');
  };

  const variaveis = [
    '{nome_cliente}',
    '{pedido_id}',
    '{fornecedor}',
    '{valor_total}',
    '{data_pedido}',
    '{status}'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-8 h-8 text-green-600" />
            Templates de WhatsApp
          </h1>
          <p className="text-gray-600">Gerencie os templates de mensagens automáticas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Variáveis Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Variáveis Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {variaveis.map(v => (
              <Badge key={v} variant="outline" className="cursor-pointer hover:bg-gray-100">
                {v}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Use estas variáveis nas mensagens para personalização automática
          </p>
        </CardContent>
      </Card>

      {/* Lista de Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map(template => (
          <Card key={template.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{template.nome}</CardTitle>
                <Badge className={template.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {template.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(template.mensagem)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Título:</p>
                  <p className="text-sm text-gray-600">{template.assunto}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Mensagem:</p>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                    {template.mensagem}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Formulário de Template */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                placeholder="Ex: Pedido Aprovado"
                required
              />
            </div>

            <div>
              <Label>Título da Mensagem</Label>
              <Input
                value={formData.assunto}
                onChange={(e) => setFormData({...formData, assunto: e.target.value})}
                placeholder="Ex: Seu pedido foi aprovado!"
                required
              />
            </div>

            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={formData.mensagem}
                onChange={(e) => setFormData({...formData, mensagem: e.target.value})}
                placeholder="Use as variáveis disponíveis para personalizar"
                rows={8}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({...formData, ativo: checked})}
              />
              <Label>Template Ativo</Label>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingTemplate(null);
                  setFormData({ nome: '', assunto: '', mensagem: '', ativo: true });
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Salvar Template
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}