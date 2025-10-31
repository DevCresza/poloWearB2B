import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, XCircle, Info } from 'lucide-react';

/**
 * Componente de notificação/toast customizável
 * @param {boolean} show - Se a notificação deve ser exibida
 * @param {string} message - Mensagem a exibir
 * @param {string} type - Tipo da notificação (success, error, info)
 * @param {Function} onClose - Callback ao fechar
 * @param {string} position - Posição da notificação na tela
 */
export function Notification({
  show,
  message,
  type = 'success',
  onClose,
  position = 'top-right'
}) {
  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getStyles = () => {
    const baseStyles = 'fixed z-50 w-96 shadow-lg';
    const positionStyles = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
    };

    const typeStyles = {
      success: 'bg-green-50 border-green-200',
      error: 'bg-red-50 border-red-200',
      info: 'bg-blue-50 border-blue-200'
    };

    return `${baseStyles} ${positionStyles[position]} ${typeStyles[type]}`;
  };

  const getTextColor = () => {
    const colors = {
      success: 'text-green-800',
      error: 'text-red-800',
      info: 'text-blue-800'
    };
    return colors[type];
  };

  const getButtonColor = () => {
    const colors = {
      success: 'text-green-600 hover:bg-green-100',
      error: 'text-red-600 hover:bg-red-100',
      info: 'text-blue-600 hover:bg-blue-100'
    };
    return colors[type];
  };

  return (
    <Alert className={getStyles()}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <AlertDescription className={`font-medium ${getTextColor()}`}>
            {message}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className={`h-6 w-6 p-0 ${getButtonColor()}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
