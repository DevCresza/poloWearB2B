import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { uploadImage } from '@/lib/storageHelpers';
import ImageEditor from '@/components/ImageEditor';
import { toast } from 'sonner';

export default function ImageUploader({ images = [], onImagesChange, maxImages = 4 }) {
  const [uploading, setUploading] = useState(false);
  const [hoveredImage, setHoveredImage] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [currentImageToEdit, setCurrentImageToEdit] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.info(`Você pode adicionar no máximo ${maxImages} imagens`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    // Converter primeiro arquivo para base64 e abrir editor
    const file = filesToProcess[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      setCurrentImageToEdit(reader.result);
      setPendingFiles(filesToProcess.slice(1)); // Guardar resto para processar depois
      setShowEditor(true);
    };
    reader.readAsDataURL(file);

    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleSaveEditedImage = async (croppedImageBlob) => {
    setUploading(true);
    try {
      // Converter Blob para File
      const file = new File([croppedImageBlob], `produto-${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });

      // Upload da imagem editada
      const result = await uploadImage(file, 'produtos');

      // Adicionar URL ao array de imagens
      onImagesChange([...images, result.url]);

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
      }
    } catch (error) {
      toast.error('Erro ao fazer upload da imagem: ') + error.message);
      setCurrentImageToEdit(null);
      setPendingFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(images);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onImagesChange(items);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {images.length} de {maxImages} imagens adicionadas
        </p>
        {images.length > 0 && (
          <p className="text-xs text-gray-500">Arraste para reordenar</p>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="images" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {images.map((image, index) => (
                <Draggable key={image} draggableId={image} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`relative group ${snapshot.isDragging ? 'z-50' : ''}`}
                      onMouseEnter={() => setHoveredImage(index)}
                      onMouseLeave={() => setHoveredImage(null)}
                    >
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          src={image}
                          alt={`Produto ${index + 1}`}
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
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Image Number Badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                        {index + 1}º
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

      {images.length < maxImages && (
        <div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-upload"
            disabled={uploading}
          />
          <label htmlFor="image-upload">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => document.getElementById('image-upload').click()}
              className="w-full cursor-pointer"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Enviando...' : `Adicionar Imagens (${maxImages - images.length} restantes)`}
            </Button>
          </label>
        </div>
      )}

      {/* Editor de Imagem */}
      {currentImageToEdit && (
        <ImageEditor
          open={showEditor}
          onClose={() => {
            setShowEditor(false);
            setCurrentImageToEdit(null);
            setPendingFiles([]);
          }}
          imageSrc={currentImageToEdit}
          onSave={handleSaveEditedImage}
          aspectRatio={1}
        />
      )}
    </div>
  );
}