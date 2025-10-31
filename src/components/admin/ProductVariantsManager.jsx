import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Image as ImageIcon, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ColorPicker from '@/components/ColorPicker';

export default function ProductVariantsManager({ variantes, onChange, gradeConfig }) {
  const [uploadingImages, setUploadingImages] = useState({});

  const addVariante = () => {
    const novaVariante = {
      id: Date.now().toString(),
      cor_nome: '',
      cor_hex: '#000000',
      fotos_urls: [],
      estoque_grades: 0,
      estoque_minimo: 0
    };
    onChange([...variantes, novaVariante]);
  };

  const removeVariante = (id) => {
    onChange(variantes.filter(v => v.id !== id));
  };

  const updateVariante = (id, field, value) => {
    onChange(variantes.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const handleImageUpload = async (varianteId, files) => {
    if (!files || files.length === 0) return;

    setUploadingImages(prev => ({ ...prev, [varianteId]: true }));

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return file_url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      
      const variante = variantes.find(v => v.id === varianteId);
      const novasFotos = [...(variante.fotos_urls || []), ...uploadedUrls];
      
      updateVariante(varianteId, 'fotos_urls', novasFotos);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      alert('Erro ao fazer upload das imagens');
    } finally {
      setUploadingImages(prev => ({ ...prev, [varianteId]: false }));
    }
  };

  const removeImage = (varianteId, imageUrl) => {
    const variante = variantes.find(v => v.id === varianteId);
    const novasFotos = variante.fotos_urls.filter(url => url !== imageUrl);
    updateVariante(varianteId, 'fotos_urls', novasFotos);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Variantes de Cor com Estoque Separado</span>
          <Button onClick={addVariante} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Cor
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {variantes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nenhuma variante cadastrada. Clique em "Adicionar Cor" para começar.
          </p>
        ) : (
          variantes.map((variante, index) => (
            <Card key={variante.id} className="border-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-lg">
                    Variante {index + 1}
                    {variante.cor_nome && ` - ${variante.cor_nome}`}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariante(variante.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Nome e Cor */}
                  <div>
                    <Label>Nome da Cor *</Label>
                    <Input
                      value={variante.cor_nome}
                      onChange={(e) => updateVariante(variante.id, 'cor_nome', e.target.value)}
                      placeholder="Ex: Azul Marinho"
                    />
                  </div>

                  <div>
                    <ColorPicker
                      value={variante.cor_hex || '#000000'}
                      onChange={(color) => updateVariante(variante.id, 'cor_hex', color)}
                      label="Cor da Variante"
                    />
                  </div>

                  {/* Estoque */}
                  <div>
                    <Label>Estoque Atual (Grades) *</Label>
                    <Input
                      type="number"
                      value={variante.estoque_grades}
                      onChange={(e) => updateVariante(variante.id, 'estoque_grades', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>

                  <div>
                    <Label>Estoque Mínimo (Grades)</Label>
                    <Input
                      type="number"
                      value={variante.estoque_minimo}
                      onChange={(e) => updateVariante(variante.id, 'estoque_minimo', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>

                {/* Fotos da Variante */}
                <div className="mt-4">
                  <Label>Fotos desta Cor</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleImageUpload(variante.id, e.target.files)}
                      className="hidden"
                      id={`upload-variante-${variante.id}`}
                    />
                    <label htmlFor={`upload-variante-${variante.id}`}>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingImages[variante.id]}
                        onClick={() => document.getElementById(`upload-variante-${variante.id}`).click()}
                        className="cursor-pointer"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingImages[variante.id] ? 'Enviando...' : 'Upload de Fotos'}
                      </Button>
                    </label>
                  </div>

                  {variante.fotos_urls && variante.fotos_urls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {variante.fotos_urls.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={url}
                            alt={`${variante.cor_nome} ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(variante.id, url)}
                            className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status do Estoque */}
                <div className="mt-3 flex gap-2">
                  {variante.estoque_grades === 0 && (
                    <Badge className="bg-red-100 text-red-800">Sem Estoque</Badge>
                  )}
                  {variante.estoque_grades > 0 && variante.estoque_grades <= variante.estoque_minimo && (
                    <Badge className="bg-orange-100 text-orange-800">Estoque Baixo</Badge>
                  )}
                  {variante.estoque_grades > variante.estoque_minimo && (
                    <Badge className="bg-green-100 text-green-800">Estoque OK</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}