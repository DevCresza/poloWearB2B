import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Archive, AlertTriangle } from 'lucide-react';

/**
 * Modal de confirmação para arquivar leads
 * @param {boolean} open - Estado de abertura
 * @param {Function} onClose - Callback ao fechar
 * @param {Function} onConfirm - Callback ao confirmar (recebe motivo)
 * @param {Object} contact - Contato a ser arquivado
 */
export default function ArchiveConfirmModal({
  open,
  onClose,
  onConfirm,
  contact
}) {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = () => {
    onConfirm(motivo);
    setMotivo('');
  };

  const handleClose = () => {
    setMotivo('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-600" />
            Arquivar Lead
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja arquivar o lead <strong>"{contact?.nome}"</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Esta ação irá:</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Remover o lead da lista ativa</li>
                  <li>• Salvar todas as informações no arquivo</li>
                  <li>• Permitir consulta posterior dos dados</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Observação sobre o arquivamento (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Adicione uma observação sobre o motivo do arquivamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Archive className="w-4 h-4 mr-2" />
            Arquivar Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
