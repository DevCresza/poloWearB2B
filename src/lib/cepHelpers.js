/**
 * Helpers para consulta de CEP via API ViaCEP
 */

/**
 * Formata o CEP removendo caracteres não numéricos
 * @param {string} cep - CEP com ou sem formatação
 * @returns {string} CEP apenas com números
 */
export const formatCepForApi = (cep) => {
  return cep.replace(/\D/g, '');
};

/**
 * Formata o CEP para exibição (XXXXX-XXX)
 * @param {string} cep - CEP apenas com números
 * @returns {string} CEP formatado
 */
export const formatCepForDisplay = (cep) => {
  const cleaned = formatCepForApi(cep);
  if (cleaned.length !== 8) return cep;
  return `${cleaned.substring(0, 5)}-${cleaned.substring(5)}`;
};

/**
 * Valida se o CEP tem formato válido
 * @param {string} cep - CEP a validar
 * @returns {boolean} true se válido
 */
export const isValidCep = (cep) => {
  const cleaned = formatCepForApi(cep);
  return /^[0-9]{8}$/.test(cleaned);
};

/**
 * Consulta endereço via CEP usando a API ViaCEP
 * @param {string} cep - CEP a consultar
 * @returns {Promise<Object>} Dados do endereço ou null se não encontrado
 */
export const consultarCep = async (cep) => {
  try {
    const cleanCep = formatCepForApi(cep);

    if (!isValidCep(cleanCep)) {
      throw new Error('CEP inválido. Deve conter 8 dígitos.');
    }


    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

    if (!response.ok) {
      throw new Error('Erro ao consultar CEP');
    }

    const data = await response.json();

    if (data.erro) {
      throw new Error('CEP não encontrado');
    }


    return {
      cep: formatCepForDisplay(data.cep),
      endereco_completo: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
      complemento: data.complemento || ''
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Hook React para consulta de CEP com debounce
 * @param {Function} onSuccess - Callback chamado quando o CEP é encontrado
 * @param {Function} onError - Callback chamado quando há erro
 * @param {number} delay - Delay em ms para o debounce (padrão: 1000)
 */
export const useCepLookup = (onSuccess, onError, delay = 1000) => {
  let timeout;

  const lookup = (cep) => {
    clearTimeout(timeout);

    if (!cep || formatCepForApi(cep).length < 8) {
      return;
    }

    timeout = setTimeout(async () => {
      try {
        const data = await consultarCep(cep);
        onSuccess(data);
      } catch (error) {
        onError(error);
      }
    }, delay);
  };

  return { lookup };
};
