import { useState } from 'react';

/**
 * Hook para gerenciar notificações/toasts na aplicação
 * Oferece métodos para mostrar notificações de sucesso, erro e info
 * As notificações desaparecem automaticamente após 4 segundos
 */
export function useNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success');

  /**
   * Mostrar notificação de sucesso
   * @param {string} message - Mensagem a exibir
   */
  const showSuccess = (message) => {
    setNotificationMessage(message);
    setNotificationType('success');
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  };

  /**
   * Mostrar notificação de erro
   * @param {string} message - Mensagem a exibir
   */
  const showError = (message) => {
    setNotificationMessage(message);
    setNotificationType('error');
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  };

  /**
   * Mostrar notificação informativa
   * @param {string} message - Mensagem a exibir
   */
  const showInfo = (message) => {
    setNotificationMessage(message);
    setNotificationType('info');
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  };

  /**
   * Ocultar notificação manualmente
   */
  const hideNotification = () => {
    setShowNotification(false);
  };

  return {
    showNotification,
    notificationMessage,
    notificationType,
    showSuccess,
    showError,
    showInfo,
    hideNotification
  };
}
