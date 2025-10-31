import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Carousel de imagens para produtos
 * Exibe imagem principal com navegação e miniaturas
 * @param {Array<string>} images - Array de URLs das imagens
 * @param {string} productName - Nome do produto para alt text
 */
export default function ProductImageCarousel({ images, productName }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaMainRef, emblaMainApi] = useEmblaCarousel();
  const [emblaThumbsRef, emblaThumbsApi] = useEmblaCarousel({
    containScroll: 'keepSnaps',
    dragFree: true,
  });

  const onThumbClick = useCallback(
    (index) => {
      if (!emblaMainApi || !emblaThumbsApi) return;
      emblaMainApi.scrollTo(index);
    },
    [emblaMainApi, emblaThumbsApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaMainApi || !emblaThumbsApi) return;
    setSelectedIndex(emblaMainApi.selectedScrollSnap());
    emblaThumbsApi.scrollTo(emblaMainApi.selectedScrollSnap());
  }, [emblaMainApi, emblaThumbsApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaMainApi) return;
    onSelect();
    emblaMainApi.on('select', onSelect);
    emblaMainApi.on('reInit', onSelect);
  }, [emblaMainApi, onSelect]);

  const scrollPrev = useCallback(() => {
    if (emblaMainApi) emblaMainApi.scrollPrev();
  }, [emblaMainApi]);

  const scrollNext = useCallback(() => {
    if (emblaMainApi) emblaMainApi.scrollNext();
  }, [emblaMainApi]);

  // Filter out empty/null images
  const validImages = (images || []).filter(img => img && img.trim() !== '');

  return (
    <div className="space-y-3">
      {/* Main Carousel */}
      <div className="relative">
        <div className="overflow-hidden rounded-lg" ref={emblaMainRef}>
          <div className="flex">
            {validImages.length > 0 ? (
              validImages.map((image, index) => (
                <div
                  key={index}
                  className="flex-[0_0_100%] min-w-0"
                >
                  <div className="aspect-[3/4] bg-gray-200">
                    <img
                      src={image}
                      alt={`${productName} - Foto ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex-[0_0_100%] min-w-0">
                <div className="aspect-[3/4] bg-gray-200 flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        {validImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={scrollPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-md rounded-full h-8 w-8"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={scrollNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-md rounded-full h-8 w-8"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Thumbnails - Always show area for consistent height */}
      <div className="overflow-hidden h-[60px]" ref={emblaThumbsRef}>
        <div className="flex gap-2 h-full">
          {validImages.length > 0 ? (
            validImages.map((image, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onThumbClick(index)}
                className={`flex-[0_0_20%] min-w-0 aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  index === selectedIndex
                    ? 'border-blue-600 opacity-100'
                    : 'border-transparent opacity-50 hover:opacity-75'
                }`}
              >
                <img
                  src={image}
                  alt={`Miniatura ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))
          ) : (
            <div className="flex-[0_0_20%] min-w-0 aspect-square rounded-lg overflow-hidden border-2 border-transparent bg-gray-200 flex items-center justify-center">
              <Package className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
