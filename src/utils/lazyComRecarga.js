import { lazy } from 'react';

// React.lazy que sobrevive a um deploy novo.
//
// Cada pagina agora e um arquivo separado com hash no nome. Quem estava com o
// portal aberto durante um deploy pede o arquivo antigo, que nao existe mais, e
// o import() falha ("Failed to fetch dynamically imported module"). Nesse caso
// recarregamos a pagina UMA vez, para pegar o index.html novo. A marca no
// sessionStorage impede laco de recarga se o erro for outro (rede caida, etc.).
const CHAVE = 'polo_chunk_recarregado';

export function lazyComRecarga(importar) {
  return lazy(async () => {
    try {
      const modulo = await importar();
      try { sessionStorage.removeItem(CHAVE); } catch { /* sem storage */ }
      return modulo;
    } catch (erro) {
      let jaRecarregou = false;
      try { jaRecarregou = sessionStorage.getItem(CHAVE) === '1'; } catch { /* sem storage */ }
      if (!jaRecarregou) {
        try { sessionStorage.setItem(CHAVE, '1'); } catch { /* sem storage */ }
        window.location.reload();
        // Segura o Suspense enquanto a pagina recarrega.
        return new Promise(() => {});
      }
      throw erro;
    }
  });
}
