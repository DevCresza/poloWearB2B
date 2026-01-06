import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RotateCw, ZoomIn, Save, X, Maximize2, Square } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Editor de Imagem com Crop, Zoom e Rotação para fotos de produtos
 *
 * @param {Object} props
 * @param {boolean} props.open - Se o dialog está aberto
 * @param {function} props.onClose - Callback ao fechar
 * @param {string} props.imageSrc - URL/Base64 da imagem a editar
 * @param {function} props.onSave - Callback ao salvar (recebe o Blob da imagem editada)
 * @param {string} props.aspectRatio - Proporção do crop (default: 1 para quadrado, 4/3 para paisagem)
 */
export default function ImageEditor({
  open,
  onClose,
  imageSrc,
  onSave,
  aspectRatio = 1
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [saving, setSaving] = useState(false);
  const [currentAspect, setCurrentAspect] = useState(aspectRatio);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Não foi possível criar contexto do canvas');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    // Usar uma abordagem mais segura para evitar problemas com tainted canvas
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');

    if (!croppedCtx) {
      throw new Error('Não foi possível criar contexto do canvas de crop');
    }

    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;

    // Desenhar diretamente no canvas de crop para evitar getImageData/putImageData
    croppedCtx.drawImage(
      canvas,
      pixelCrop.x + (safeArea / 2 - image.width * 0.5),
      pixelCrop.y + (safeArea / 2 - image.height * 0.5),
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      croppedCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao gerar imagem recortada. Tente novamente.'));
          }
        },
        'image/jpeg',
        0.92
      );
    });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    setSaving(true);
    try {
      const croppedImageBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );

      // Aguardar o onSave terminar - o callback decide se fecha ou não
      await Promise.resolve(onSave(croppedImageBlob));
      // NÃO chamar onClose aqui - o callback onSave controla o fechamento
      // Isso permite que o ImageUploader processe múltiplos arquivos em sequência
    } catch (_error) {
      toast.error('Erro ao processar a imagem. Tente novamente.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ZoomIn className="w-5 h-5" />
            Editar Foto do Produto
          </DialogTitle>
        </DialogHeader>

        {/* Container scrollável para o conteúdo */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Área de Crop */}
          <div className="relative h-[400px] bg-gray-900 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={currentAspect}
              cropShape="rect"
              showGrid={true}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
            />
          </div>

          {/* Controles */}
          <div className="space-y-4 pb-4">
          {/* Proporção */}
          <div className="space-y-2">
            <Label>Proporção da Imagem</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={currentAspect === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentAspect(1)}
                className="gap-2"
              >
                <Square className="w-4 h-4" />
                Quadrado (1:1)
              </Button>
              <Button
                type="button"
                variant={currentAspect === 4/3 ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentAspect(4/3)}
                className="gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Paisagem (4:3)
              </Button>
              <Button
                type="button"
                variant={currentAspect === 3/4 ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentAspect(3/4)}
                className="gap-2"
              >
                <Maximize2 className="w-4 h-4 rotate-90" />
                Retrato (3:4)
              </Button>
              <Button
                type="button"
                variant={currentAspect === 16/9 ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentAspect(16/9)}
                className="gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Widescreen (16:9)
              </Button>
            </div>
          </div>

          {/* Zoom */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4" />
                Zoom
              </Label>
              <span className="text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
            </div>
            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Rotação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                Rotação
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRotate}
                className="gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Girar 90°
              </Button>
            </div>
            <Slider
              value={[rotation]}
              onValueChange={([value]) => setRotation(value)}
              min={0}
              max={360}
              step={1}
              className="w-full"
            />
            <div className="text-xs text-gray-600 text-center">
              {rotation}°
            </div>
          </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Imagem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
