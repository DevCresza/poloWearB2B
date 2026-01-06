import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Upload, X, GripVertical } from 'lucide-react';
import { uploadImage } from '@/lib/storageHelpers';
import ImageEditor from '@/components/ImageEditor';
import ColorPicker from '@/components/ColorPicker';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function ProductVariantsManager({ variantes = [], onChange, gradeConfig, disponibilidade, onPhotoAdded }) {
  const [uploadingImages, setUploadingImages] = useState({});
  const [showEditor, setShowEditor] = useState(false);
  const [currentImageToEdit, setCurrentImageToEdit] = useState(null);
  const [currentVarianteId, setCurrentVarianteId] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  // Garantir que variantes seja sempre um array
  const variantesArray = Array.isArray(variantes) ? variantes : [];

  const addVariante = () => {
    const novaVariante = {
      id: Date.now().toString(),
      cor_nome: '',
      cor_codigo_hex: '#000000',
      fotos_urls: [],
      estoque_grades: 0,
      estoque_minimo: 0
    };
    onChange([...variantesArray, novaVariante]);
  };

  const removeVariante = (id) => {
    onChange(variantesArray.filter(v => v.id !== id));
  };

  const updateVariante = (id, field, value) => {
    const novasVariantes = variantesArray.map(v =>
      v.id === id ? { ...v, [field]: value } : v
    );

    console.log('🔄 Atualizando variante:', {
      id,
      field,
      value,
      varianteAtualizada: novasVariantes.find(v => v.id === id)
    });

    onChange(novasVariantes);
  };

  const handleFileSelect = (varianteId, e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const variante = variantes.find(v => v.id === varianteId);
    const currentPhotos = variante.fotos_urls || [];
    const maxImages = 4;
    const remainingSlots = maxImages - currentPhotos.length;

    if (remainingSlots <= 0) {
      toast.info(`Você pode adicionar no máximo ${maxImages} imagens por cor`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    // Converter primeiro arquivo para base64 e abrir editor
    const file = filesToProcess[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setCurrentImageToEdit(reader.result);
      setCurrentVarianteId(varianteId);
      setPendingFiles(filesToProcess.slice(1)); // Guardar resto para processar depois
      setShowEditor(true);
    };
    reader.readAsDataURL(file);

    // Limpar input
    e.target.value = '';
  };

  const handleSaveEditedImage = async (croppedImageBlob) => {
    setUploadingImages(prev => ({ ...prev, [currentVarianteId]: true }));
    try {
      // Converter Blob para File
      const file = new File([croppedImageBlob], `variante-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });

      // Upload da imagem editada
      const result = await uploadImage(file, 'produtos');

      if (!result.success) {
        throw new Error(result.error || 'Erro ao fazer upload');
      }

      // Adicionar URL ao array de imagens da variante
      const variante = variantesArray.find(v => v.id === currentVarianteId);
      const novasFotos = [...(variante.fotos_urls || []), result.url];

      console.log('📸 Adicionando foto à variante:', {
        varianteId: currentVarianteId,
        corNome: variante.cor_nome,
        fotosAntes: variante.fotos_urls?.length || 0,
        fotosDepois: novasFotos.length,
        novaUrl: result.url
      });

      updateVariante(currentVarianteId, 'fotos_urls', novasFotos);

      // Notificar o componente pai para adicionar também às fotos principais com metadados da cor
      if (onPhotoAdded) {
        onPhotoAdded({
          url: result.url,
          cor_nome: variante.cor_nome,
          cor_codigo_hex: variante.cor_codigo_hex
        });
      }

      toast.success('Foto adicionada com sucesso!');

      // Se houver mais arquivos pendentes, processar o próximo
      if (pendingFiles.length > 0) {
        const nextFile = pendingFiles[0];
        const reader = new FileReader();
        reader.onloadend = () => {
          setCurrentImageToEdit(reader.result);
          setPendingFiles(pendingFiles.slice(1));
          setShowEditor(true);
        };
        reader.readAsDataURL(nextFile);
      } else {
        setCurrentImageToEdit(null);
        setCurrentVarianteId(null);
      }
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error(`Erro ao fazer upload: ${error.message}`);
      setCurrentImageToEdit(null);
      setCurrentVarianteId(null);
      setPendingFiles([]);
    } finally {
      setUploadingImages(prev => ({ ...prev, [currentVarianteId]: false }));
    }
  };

  const removeImage = (varianteId, imageUrl) => {
    const variante = variantesArray.find(v => v.id === varianteId);
    const novasFotos = variante.fotos_urls.filter(url => url !== imageUrl);
    updateVariante(varianteId, 'fotos_urls', novasFotos);
    toast.success('Foto removida com sucesso!');
  };

  const handleDragEnd = (varianteId, result) => {
    if (!result.destination) return;

    const variante = variantesArray.find(v => v.id === varianteId);
    const items = Array.from(variante.fotos_urls || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    updateVariante(varianteId, 'fotos_urls', items);
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
        {variantesArray.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nenhuma variante cadastrada. Clique em "Adicionar Cor" para começar.
          </p>
        ) : (
          variantesArray.map((variante, index) => (
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
                      value={variante.cor_codigo_hex || '#000000'}
                      onChange={(color) => updateVariante(variante.id, 'cor_codigo_hex', color)}
                      label="Cor da Variante"
                    />
                  </div>

                  {/* Estoque - Somente para Pronta Entrega */}
                  {disponibilidade === 'pronta_entrega' && (
                    <>
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
                    </>
                  )}
                  {(disponibilidade === 'pre_venda' || disponibilidade === 'sob_encomenda') && (
                    <div className="col-span-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          Este produto está em <strong>Pré-Venda/Sob Encomenda</strong>. O estoque não é controlado para produtos neste modo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fotos da Variante */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Fotos desta Cor</Label>
                    <div className="flex items-center gap-2">
                      {variante.fotos_urls?.length > 0 && (
                        <span className="text-sm text-gray-600">
                          {variante.fotos_urls.length} de 4 imagens
                        </span>
                      )}
                      {variante.fotos_urls?.length > 1 && (
                        <span className="text-xs text-gray-500">Arraste para reordenar</span>
                      )}
                    </div>
                  </div>

                  {/* Grid de Imagens com Drag & Drop */}
                  {(() => {
                    const fotos = variante.fotos_urls || [];
                    console.log(`Variante ${variante.cor_nome}:`, {
                      fotos_urls: fotos,
                      length: fotos.length,
                      isArray: Array.isArray(fotos)
                    });

                    return Array.isArray(fotos) && fotos.length > 0 ? (
                      <DragDropContext onDragEnd={(result) => handleDragEnd(variante.id, result)}>
                        <Droppable droppableId={`variante-${variante.id}`} direction="horizontal">
                          {(provided) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              className="grid grid-cols-4 gap-3 mb-3"
                            >
                              {fotos.map((url, idx) => (
                              <Draggable key={url} draggableId={url} index={idx}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`relative group ${snapshot.isDragging ? 'z-50' : ''}`}
                                  >
                                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                                      <img
                                        src={url}
                                        alt={`${variante.cor_nome} ${idx + 1}`}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                      />
                                    </div>

                                    {/* Drag Handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      className="absolute top-2 left-2 p-1.5 bg-white rounded-md shadow-md cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <GripVertical className="w-4 h-4 text-gray-600" />
                                    </div>

                                    {/* Remove Button */}
                                    <button
                                      type="button"
                                      onClick={() => removeImage(variante.id, url)}
                                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>

                                    {/* Image Number Badge */}
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                                      {idx + 1}º
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    ) : null;
                  })()}

                  {/* Botão de Upload */}
                  {(!variante.fotos_urls || variante.fotos_urls.length < 4) && (
                    <div className="mt-2">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileSelect(variante.id, e)}
                        className="hidden"
                        id={`upload-variante-${variante.id}`}
                        disabled={uploadingImages[variante.id]}
                      />
                      <label htmlFor={`upload-variante-${variante.id}`}>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingImages[variante.id]}
                          onClick={() => document.getElementById(`upload-variante-${variante.id}`).click()}
                          className="w-full cursor-pointer"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingImages[variante.id]
                            ? 'Enviando...'
                            : `Adicionar Imagens (${4 - (variante.fotos_urls?.length || 0)} restantes)`
                          }
                        </Button>
                      </label>
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

      {/* Editor de Imagem */}
      {currentImageToEdit && (
        <ImageEditor
          open={showEditor}
          onClose={() => {
            setShowEditor(false);
            setCurrentImageToEdit(null);
            setCurrentVarianteId(null);
            setPendingFiles([]);
          }}
          imageSrc={currentImageToEdit}
          onSave={handleSaveEditedImage}
          aspectRatio={1}
        />
      )}
    </Card>
  );
}