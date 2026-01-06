import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Recurso } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Save, X, Upload, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RecursoForm({ recurso, onClose, onSuccess }) {
  const [formData, setFormData] = useState(recurso || {
    titulo: '',
    descricao: '',
    tipo: 'artigo',
    categoria: 'treinamento',
    conteudo: '',
    arquivo_url: '',
    thumbnail_url: '',
    video_url: '',
    disponivel_para: 'todos',
    is_destaque: false,
    ativo: true,
    ordem: 0
  });
  const [salvando, setSalvando] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [checklistItems, setChecklistItems] = useState(
    formData.tipo === 'checklist' && formData.conteudo
      ? JSON.parse(formData.conteudo)
      : ['']
  );

  const handleFileUpload = async (file, field) => {
    if (field === 'arquivo_url') {
      setUploadingFile(true);
    } else {
      setUploadingThumb(true);
    }

    try {
      const result = await UploadFile({ file });
      const fileUrl = result.url || result.file_url;
      setFormData({ ...formData, [field]: fileUrl });
    } catch (_error) {
      toast.error('Erro ao fazer upload do arquivo.');
    } finally {
      setUploadingFile(false);
      setUploadingThumb(false);
    }
  };

  const handleChecklistChange = (index, value) => {
    const newItems = [...checklistItems];
    newItems[index] = value;
    setChecklistItems(newItems);
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const removeChecklistItem = (index) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.titulo || !formData.tipo || !formData.disponivel_para) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSalvando(true);

    try {
      let conteudoFinal = formData.conteudo;

      // Para checklist, salvar como JSON
      if (formData.tipo === 'checklist') {
        const itemsFiltrados = checklistItems.filter(item => item.trim() !== '');
        conteudoFinal = JSON.stringify(itemsFiltrados);
      }

      const dados = {
        ...formData,
        nome: formData.titulo, // Mapear titulo para nome (coluna obrigatória)
        conteudo: conteudoFinal
      };

      if (recurso) {
        await Recurso.update(recurso.id, dados);
      } else {
        await Recurso.create(dados);
      }

      toast.success(recurso ? 'Conteúdo atualizado com sucesso!' : 'Conteúdo criado com sucesso!');
      onSuccess();
    } catch (_error) {
      toast.error('Erro ao salvar Conteúdo. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">
            {recurso ? 'Editar Conteúdo' : 'Novo Conteúdo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo" className="text-gray-300">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Guia de Vendas 2024"
              required
              className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500 "
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao" className="text-gray-300">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Breve descrição do Conteúdo..."
              rows={3}
              className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500 "
            />
          </div>

          {/* Tipo e Categoria */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-gray-300">Tipo de Conteúdo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger className="bg-gray-800 text-white border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700">
                  <SelectItem value="artigo" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Artigo/Texto</SelectItem>
                  <SelectItem value="video" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Vídeo</SelectItem>
                  <SelectItem value="lookbook" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Lookbook</SelectItem>
                  <SelectItem value="checklist" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Checklist</SelectItem>
                  <SelectItem value="marketing" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Material de Marketing</SelectItem>
                  <SelectItem value="imagem" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria" className="text-gray-300">Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger className="bg-gray-800 text-white border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700">
                  <SelectItem value="treinamento" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Treinamento</SelectItem>
                  <SelectItem value="marketing" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Marketing</SelectItem>
                  <SelectItem value="produto" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Produto</SelectItem>
                  <SelectItem value="capsula" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Cápsula</SelectItem>
                  <SelectItem value="vendas" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Vendas</SelectItem>
                  <SelectItem value="operacional" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Operacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conteúdo baseado no tipo */}
          {formData.tipo === 'artigo' && (
            <div className="space-y-2">
              <Label htmlFor="conteudo" className="text-gray-300">Conteúdo do Artigo</Label>
              <Textarea
                id="conteudo"
                value={formData.conteudo}
                onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                placeholder="Digite o conteúdo do artigo..."
                rows={10}
                className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500 "
              />
            </div>
          )}

          {formData.tipo === 'video' && (
            <div className="space-y-2">
              <Label htmlFor="video_url" className="text-gray-300">URL do Vídeo (YouTube) *</Label>
              <Input
                id="video_url"
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500 "
              />
            </div>
          )}

          {formData.tipo === 'checklist' && (
            <div className="space-y-2">
              <Label className="text-gray-300">Itens do Checklist</Label>
              <div className="space-y-2">
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) => handleChecklistChange(index, e.target.value)}
                      placeholder={`Item ${index + 1}`}
                      className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500 "
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeChecklistItem(index)}
                      className="border-gray-600 hover:bg-gray-800 text-gray-200 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addChecklistItem}
                  className="w-full border-gray-300 hover:bg-white text-gray-900"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>
            </div>
          )}

          {/* Upload de Arquivo */}
          {(formData.tipo === 'lookbook' || formData.tipo === 'marketing' || formData.tipo === 'imagem') && (
            <div className="space-y-2">
              <Label htmlFor="arquivo" className="text-gray-300">Arquivo *</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  id="arquivo"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) handleFileUpload(file, 'arquivo_url');
                  }}
                  accept="image/*,application/pdf"
                  disabled={uploadingFile}
                  className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500  file:bg-gray-700 file:text-white file:border-gray-600 file:hover:bg-gray-600"
                />
                {formData.arquivo_url && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(formData.arquivo_url, '_blank')}
                    className="border-gray-600 hover:bg-gray-800 text-gray-200 hover:text-white"
                  >
                    Ver Arquivo
                  </Button>
                )}
              </div>
              {uploadingFile && <p className="text-sm text-blue-400">Fazendo upload...</p>}
            </div>
          )}

          {/* Thumbnail */}
          <div className="space-y-2">
            <Label htmlFor="thumbnail" className="text-gray-300">Imagem de Capa (opcional)</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                id="thumbnail"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleFileUpload(file, 'thumbnail_url');
                }}
                accept="image/*"
                disabled={uploadingThumb}
                className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500  file:bg-gray-700 file:text-white file:border-gray-600 file:hover:bg-gray-600"
              />
              {formData.thumbnail_url && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(formData.thumbnail_url, '_blank')}
                  className="border-gray-600 hover:bg-gray-800 text-gray-200 hover:text-white"
                >
                  Ver Imagem
                </Button>
              )}
            </div>
            {uploadingThumb && <p className="text-sm text-blue-400">Fazendo upload...</p>}
          </div>

          {/* Disponível Para */}
          <div className="space-y-2">
            <Label htmlFor="disponivel_para" className="text-gray-300">Disponível Para *</Label>
            <Select
              value={formData.disponivel_para}
              onValueChange={(value) => setFormData({ ...formData, disponivel_para: value })}
            >
              <SelectTrigger className="bg-gray-800 text-white border-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                <SelectItem value="todos" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Todos os Usuários</SelectItem>
                <SelectItem value="multimarcas" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Apenas Multimarcas</SelectItem>
                <SelectItem value="fornecedores" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Apenas Fornecedores</SelectItem>
                <SelectItem value="ambos" className="focus:bg-gray-700 focus:text-white data-[state=checked]:bg-red-700 data-[state=checked]:text-white">Multimarcas e Fornecedores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Opções */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_destaque"
                checked={formData.is_destaque}
                onCheckedChange={(checked) => setFormData({ ...formData, is_destaque: checked })}
                className="border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
              />
              <Label htmlFor="is_destaque" className="font-normal cursor-pointer text-gray-300">
                Marcar como destaque
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                className="border-gray-300 data-[state=checked]:bg-red-600 data-[state=checked]:text-white"
              />
              <Label htmlFor="ativo" className="font-normal cursor-pointer text-gray-300">
                Conteúdo ativo e visível
              </Label>
            </div>
          </div>

          {/* Ordem de Exibição */}
          <div className="space-y-2">
            <Label htmlFor="ordem" className="text-gray-300">Ordem de Exibição</Label>
            <Input
              id="ordem"
              type="number"
              value={formData.ordem}
              onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="bg-gray-800 text-white border-gray-700 placeholder:text-gray-500 "
            />
            <p className="text-xs text-gray-500">Conteúdos com menor número aparecem primeiro</p>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-600 hover:bg-gray-800 text-gray-200 hover:text-white">
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="bg-red-600 hover:bg-red-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              {salvando ? 'Salvando...' : (recurso ? 'Atualizar' : 'Criar Conteúdo')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
