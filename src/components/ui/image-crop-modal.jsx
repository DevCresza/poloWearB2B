import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Square, RectangleVertical } from 'lucide-react';

/**
 * Cria elemento Image e retorna Promise
 */
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Recorta a imagem baseado nas coordenadas de crop
 */
const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.95);
  });
};

/**
 * Modal para recortar/enquadrar imagens
 * Suporta múltiplos aspect ratios e zoom
 * @param {boolean} open - Estado de abertura do modal
 * @param {Function} onClose - Callback ao fechar
 * @param {string} imageSrc - URL da imagem original
 * @param {Function} onCropComplete - Callback com imagem recortada (url, blob)
 */
export default function ImageCropModal({ open, onClose, imageSrc, onCropComplete }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(3 / 4);

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const croppedImageUrl = URL.createObjectURL(croppedImageBlob);
      onCropComplete(croppedImageUrl, croppedImageBlob);
      onClose();
    } catch (e) {
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajustar Enquadramento da Imagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Formato */}
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              variant={aspectRatio === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setAspectRatio(1)}
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Quadrado (1:1)
            </Button>
            <Button
              type="button"
              variant={aspectRatio === 3/4 ? "default" : "outline"}
              size="sm"
              onClick={() => setAspectRatio(3/4)}
              className="flex items-center gap-2"
            >
              <RectangleVertical className="w-4 h-4" />
              Retrato (3:4)
            </Button>
          </div>

          {/* Área de Crop */}
          <div className="relative w-full h-[400px] bg-gray-100 rounded-lg overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteCallback}
                cropShape="rect"
                showGrid={true}
              />
            )}
          </div>

          {/* Controle de Zoom */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-gray-600" />
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={1}
                max={3}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Arraste a imagem para posicionar e use o controle para ajustar o zoom
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">
            Confirmar Enquadramento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
