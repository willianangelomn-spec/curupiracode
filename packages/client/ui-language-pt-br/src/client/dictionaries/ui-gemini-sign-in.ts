/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-gemini-sign-in`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-gemini-sign-in/src/client/index.ts'

/** `geminiSignIn` namespace, complete against its owning key set. */
export const geminiSignInPtBr = {
  checking: 'Verificando o login do Google…',
  signedIn: 'Conectado ao Google pelo Antigravity CLI.',
  signedOut: 'Entre com sua conta Google para usar os modelos Gemini, incluindo o Gemini 4 Argon. Não é preciso chave de API.',
  signIn: 'Entrar com Google',
  starting: 'Abrindo o login…',
  stepOpen: '1. Abra a página do Google e autorize o acesso.',
  openPage: 'Abrir a página de login do Google',
  stepPaste: '2. Copie o código que o Google mostra no final e cole aqui.',
  codeLabel: 'Código de autorização',
  codePlaceholder: 'Cole o código',
  confirm: 'Confirmar',
  confirming: 'Confirmando…',
  cancel: 'Cancelar',
  recheck: 'Verificar de novo',
  refused: 'O login não foi concluído: {reason}',
  cliMissing: 'O Antigravity CLI (agy) não está instalado no computador que roda o CurupiraCode. Instale-o com o comando abaixo e verifique de novo.',
  unavailable: 'Não foi possível ler o estado do login: {reason}',
} satisfies LocaleDictOf<'geminiSignIn'>
