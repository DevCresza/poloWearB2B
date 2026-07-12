// NAO IMPORTADO pelas Edge Functions.
//
// Estas funcoes rodam com SERVICE_ROLE_KEY (ignora RLS e trigger). Sem checar QUEM
// chamou, qualquer usuario logado criava um admin ou trocava a senha do admin —
// `verify_jwt` so garante "tem um JWT valido", nao "e admin".
//
// A checagem foi COPIADA INLINE em cada funcao (create-user, update-user-password,
// update-user-email, resetUserPassword) em vez de importada daqui, porque nenhuma
// funcao publicada usava `../_shared/*` e o deploy desse caminho nunca foi exercido
// neste projeto — um erro de resolucao derrubaria a gestao de usuarios em producao.
//
// Este arquivo fica como referencia do padrao. Se um dia o deploy com _shared for
// validado, as 4 copias podem passar a importar daqui.
//
// Padrao original: deleteAuthUser/index.ts:17-55.
export {};
