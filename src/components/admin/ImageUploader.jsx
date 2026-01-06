import { useState, useRef } from 'react';
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

  // Ref para acumular imagens durante uploads múltiplos (evita problema de closure stale)
  const accumulatedImagesRef = useRef([]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.info(`Você pode adicionar no máximo ${maxImages} imagens`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    // Inicializar ref com imagens atuais para acumular durante uploads múltiplos
    accumulatedImagesRef.current = [...images];

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

      if (!result.success) {
        throw new Error(result.error || 'Erro ao fazer upload');
      }

      // Acumular no ref para manter estado atualizado entre uploads múltiplos
      accumulatedImagesRef.current = [...accumulatedImagesRef.current, result.url];

      // Capturar pendingFiles atual antes de qualquer operação assíncrona
      const currentPendingFiles = [...pendingFiles];

      // Se houver mais arquivos pendentes, processar o próximo
      if (currentPendingFiles.length > 0) {
        const nextFile = currentPendingFiles[0];
        // Atualizar pendingFiles ANTES de iniciar o reader
        setPendingFiles(currentPendingFiles.slice(1));

        const reader = new FileReader();
        reader.onloadend = () => {
          setCurrentImageToEdit(reader.result);
          // Modal já está aberto, não precisa setar showEditor
        };
        reader.readAsDataURL(nextFile);
      } else {
        // Todos os arquivos processados - atualizar estado final e fechar modal
        onImagesChange(accumulatedImagesRef.current);
        setCurrentImageToEdit(null);
        setShowEditor(false);
        accumulatedImagesRef.current = [];
      }
    } catch (error) {
      toast.error(`Erro ao fazer upload da imagem: ${error.message}`);
      // Em caso de erro, salvar as imagens já acumuladas
      if (accumulatedImagesRef.current.length > images.length) {
        onImagesChange(accumulatedImagesRef.current);
      }
      setCurrentImageToEdit(null);
      setShowEditor(false);
      setPendingFiles([]);
      accumulatedImagesRef.current = [];
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
              {images.map((image, index) => {
                // Suportar tanto strings (formato antigo) quanto objetos (com metadados)
                const imageUrl = typeof image === 'string' ? image : image.url;
                const imageData = typeof image === 'string' ? null : image;
                const hasColorTag = imageData && imageData.cor_nome;

                return (
                  <Draggable key={imageUrl} draggableId={imageUrl} index={index}>
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
                            src={imageUrl}
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

                        {/* Color Tag Badge - Sempre visível se houver */}
                        {hasColorTag && (
                          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full shadow-lg flex items-center gap-1.5"
                               style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
                            <div
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: imageData.cor_codigo_hex }}
                            />
                            <span className="text-xs font-medium text-gray-800">
                              {imageData.cor_nome}
                            </span>
                          </div>
                        )}

                        {/* Image Number Badge */}
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                          {index + 1}º
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
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
            // Se havia imagens acumuladas antes de fechar, salvar elas
            if (accumulatedImagesRef.current.length > images.length) {
              onImagesChange(accumulatedImagesRef.current);
            }
            accumulatedImagesRef.current = [];
          }}
          imageSrc={currentImageToEdit}
          onSave={handleSaveEditedImage}
          aspectRatio={1}
        />
      )}
    </div>
  );
}