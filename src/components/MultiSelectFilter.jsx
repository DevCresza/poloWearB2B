import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, X } from 'lucide-react';

/**
 * Componente de filtro multi-select com dropdown
 * @param {string} label - Label do botão
 * @param {Array} options - Array de { value, label, color? }
 * @param {Array} selected - Array de valores selecionados
 * @param {Function} onToggle - Callback ao selecionar/desmarcar (value)
 * @param {Function} onClear - Callback ao limpar todos
 */
export default function MultiSelectFilter({ label, options, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const count = selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 ${count > 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : ''}`}
        >
          {label}
          {count > 0 && (
            <Badge className="bg-blue-600 text-white h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
              {count}
            </Badge>
          )}
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {count > 0 && (
            <button
              onClick={() => { onClear(); }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700 flex-1">{option.label}</span>
              {option.color && (
                <span className={`w-2 h-2 rounded-full ${option.color}`} />
              )}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
