import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut, AlertTriangle } from 'lucide-react';

/**
 * Modal de confirmação de logout
 * @param {boolean} open - Estado de abertura do modal
 * @param {Function} onClose - Callback para fechar o modal
 * @param {Function} onConfirm - Callback ao confirmar logout
 */
export default function LogoutConfirmModal({ open, onClose, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-red-600" />
            Confirmar Logout
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Tem certeza que deseja sair do sistema?</p>
                <p className="mt-1 text-xs">Você será redirecionado para a página inicial.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair do Sistema
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
