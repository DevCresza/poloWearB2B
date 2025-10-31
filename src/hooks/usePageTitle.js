import { useEffect } from 'react';

/**
 * Hook customizado para gerenciar títulos das páginas
 * Atualiza o título da página e opcionalmente a meta description
 *
 * @param {string} title - Título específico da página
 * @param {string} description - Descrição opcional para a meta tag
 *
 * @example
 * usePageTitle('Catálogo', 'Navegue pelo nosso catálogo de produtos');
 */
export const usePageTitle = (title, description = null) => {
  useEffect(() => {
    const baseTitle = 'Polo Wear Multimarcas';
    const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;

    // Atualizar título da página
    document.title = fullTitle;

    // Atualizar meta description se fornecida
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');

      // Criar meta description se não existir
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }

      metaDescription.setAttribute('content', description);
    }

    // Cleanup: restaura título padrão ao desmontar
    return () => {
      document.title = baseTitle;
    };
  }, [title, description]);
};

export default usePageTitle;
