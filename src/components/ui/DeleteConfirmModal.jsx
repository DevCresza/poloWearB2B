import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';

/**
 * Modal reutilizável para confirmação de exclusão
 * @param {boolean} open - Estado de abertura do modal
 * @param {Function} onClose - Callback para fechar o modal
 * @param {Function} onConfirm - Callback ao confirmar exclusão
 * @param {string} title - Título do modal
 * @param {string} itemName - Nome do item a ser excluído
 * @param {string} itemType - Tipo do item (produto, usuário, etc.)
 * @param {ReactNode} children - Conteúdo adicional opcional
 */
export default function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirmar Exclusão",
  itemName = "este item",
  itemType = "item",
  children
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Confirme a exclusão de {itemType} "{itemName}". Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">
                  Tem certeza que deseja excluir {itemType} "{itemName}"?
                </p>
                <p className="mt-1 text-xs">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
          </div>

          {children && (
            <div className="text-sm text-gray-600">
              {children}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
