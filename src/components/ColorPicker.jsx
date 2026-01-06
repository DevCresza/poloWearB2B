import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Hash, Droplet } from 'lucide-react';

/**
 * Componente ColorPicker com suporte a HEX, RGB e cores pré-definidas
 *
 * @param {Object} props
 * @param {string} props.value - Valor atual da cor (HEX)
 * @param {function} props.onChange - Callback quando a cor muda
 * @param {string} props.label - Label do campo
 */
export default function ColorPicker({ value, onChange, label = "Cor" }) {
  const [activeTab, setActiveTab] = useState('preset');

  // Paleta de cores pré-definidas (cores comuns em roupas)
  const presetColors = [
    { name: 'Branco', hex: '#FFFFFF' },
    { name: 'Preto', hex: '#000000' },
    { name: 'Cinza', hex: '#808080' },
    { name: 'Cinza Claro', hex: '#D3D3D3' },
    { name: 'Cinza Escuro', hex: '#404040' },
    { name: 'Vermelho', hex: '#FF0000' },
    { name: 'Vermelho Escuro', hex: '#8B0000' },
    { name: 'Bordô', hex: '#800020' },
    { name: 'Rosa', hex: '#FFC0CB' },
    { name: 'Rosa Choque', hex: '#FF1493' },
    { name: 'Azul', hex: '#0000FF' },
    { name: 'Azul Marinho', hex: '#000080' },
    { name: 'Azul Royal', hex: '#4169E1' },
    { name: 'Azul Claro', hex: '#87CEEB' },
    { name: 'Azul Turquesa', hex: '#40E0D0' },
    { name: 'Verde', hex: '#008000' },
    { name: 'Verde Escuro', hex: '#006400' },
    { name: 'Verde Musgo', hex: '#556B2F' },
    { name: 'Verde Água', hex: '#00FFFF' },
    { name: 'Amarelo', hex: '#FFFF00' },
    { name: 'Amarelo Ouro', hex: '#FFD700' },
    { name: 'Mostarda', hex: '#E1AD01' },
    { name: 'Laranja', hex: '#FFA500' },
    { name: 'Laranja Queimado', hex: '#CC5500' },
    { name: 'Marrom', hex: '#8B4513' },
    { name: 'Bege', hex: '#F5F5DC' },
    { name: 'Caramelo', hex: '#C68E17' },
    { name: 'Roxo', hex: '#800080' },
    { name: 'Roxo Escuro', hex: '#4B0082' },
    { name: 'Lilás', hex: '#C8A2C8' },
    { name: 'Vinho', hex: '#722F37' },
    { name: 'Nude', hex: '#E3BC9A' },
  ];

  // Converter HEX para RGB
  const hexToRgb = (hex) => {
    if (!hex || !hex.startsWith('#')) return { r: 0, g: 0, b: 0 };
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Converter RGB para HEX
  const rgbToHex = (r, g, b) => {
    return "#" + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join('');
  };

  const currentRgb = hexToRgb(value);
  const [rgb, setRgb] = useState(currentRgb);

  const handleRgbChange = (channel, val) => {
    const newRgb = { ...rgb, [channel]: parseInt(val) || 0 };
    setRgb(newRgb);
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  const handlePresetClick = (hex) => {
    onChange(hex);
    setRgb(hexToRgb(hex));
  };

  const validHex = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000';

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Palette className="w-4 h-4" />
        {label}
      </Label>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preset" className="gap-2">
            <Palette className="w-4 h-4" />
            Paleta
          </TabsTrigger>
          <TabsTrigger value="hex" className="gap-2">
            <Hash className="w-4 h-4" />
            HEX
          </TabsTrigger>
          <TabsTrigger value="rgb" className="gap-2">
            <Droplet className="w-4 h-4" />
            RGB
          </TabsTrigger>
        </TabsList>

        {/* Preview da cor atual */}
        <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div
            className="w-16 h-16 rounded-lg border-2 border-gray-300 shadow-inner"
            style={{ backgroundColor: validHex }}
          />
          <div>
            <p className="text-sm font-semibold text-gray-700">Cor Selecionada</p>
            <p className="text-xs text-gray-500">{validHex}</p>
            <p className="text-xs text-gray-500">
              RGB({currentRgb.r}, {currentRgb.g}, {currentRgb.b})
            </p>
          </div>
        </div>

        {/* Paleta de cores pré-definidas */}
        <TabsContent value="preset" className="space-y-3 mt-4">
          <div className="grid grid-cols-8 gap-2 max-h-80 overflow-y-auto p-2 relative">
            {presetColors.map((color) => (
              <div key={color.hex} className="relative group">
                <button
                  onClick={() => handlePresetClick(color.hex)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 hover:shadow-lg ${
                    value === color.hex ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {value === color.hex && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full border border-gray-400" />
                    </div>
                  )}
                </button>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none">
                  {color.name}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Passe o mouse sobre as cores para ver o nome
          </p>
        </TabsContent>

        {/* Seletor HEX */}
        <TabsContent value="hex" className="space-y-3 mt-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="color-picker">Seletor Visual</Label>
              <div className="flex gap-3 items-center mt-2">
                <Input
                  id="color-picker"
                  type="color"
                  value={validHex}
                  onChange={(e) => {
                    onChange(e.target.value);
                    setRgb(hexToRgb(e.target.value));
                  }}
                  className="w-20 h-12 cursor-pointer"
                />
                <div
                  className="flex-1 h-12 rounded border-2 border-gray-300"
                  style={{ backgroundColor: validHex }}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="hex-input">Código HEX</Label>
              <Input
                id="hex-input"
                value={value || ''}
                onChange={(e) => {
                  onChange(e.target.value);
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setRgb(hexToRgb(e.target.value));
                  }
                }}
                placeholder="#000000"
                maxLength={7}
                className="font-mono uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">
                Digite no formato: #RRGGBB (ex: #FF5733)
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Seletor RGB */}
        <TabsContent value="rgb" className="space-y-3 mt-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="rgb-r">Vermelho (R)</Label>
                <span className="text-sm font-mono text-gray-600">{rgb.r}</span>
              </div>
              <div className="flex gap-3 items-center">
                <Input
                  id="rgb-r"
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => handleRgbChange('r', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.r}
                  onChange={(e) => handleRgbChange('r', e.target.value)}
                  className="w-20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="rgb-g">Verde (G)</Label>
                <span className="text-sm font-mono text-gray-600">{rgb.g}</span>
              </div>
              <div className="flex gap-3 items-center">
                <Input
                  id="rgb-g"
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => handleRgbChange('g', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.g}
                  onChange={(e) => handleRgbChange('g', e.target.value)}
                  className="w-20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="rgb-b">Azul (B)</Label>
                <span className="text-sm font-mono text-gray-600">{rgb.b}</span>
              </div>
              <div className="flex gap-3 items-center">
                <Input
                  id="rgb-b"
                  type="range"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => handleRgbChange('b', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  max="255"
                  value={rgb.b}
                  onChange={(e) => handleRgbChange('b', e.target.value)}
                  className="w-20"
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">RGB:</span> rgb({rgb.r}, {rgb.g}, {rgb.b})
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">HEX:</span> {rgbToHex(rgb.r, rgb.g, rgb.b)}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
