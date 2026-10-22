/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-sidebar-browser`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-browser/src/client/locales.ts'

/** `sidebarBrowser` namespace, complete against its owning key set. */
export const sidebarBrowserPtBr = {
  'type.label': 'Navegador',
  'guide.title': 'Navegador',
  'guide.description': 'Navegue por páginas da web',
  'shortcut.noSession': 'Abra uma sessão primeiro',
  'address.placeholder': 'Digite um endereço HTTP(S)',
  'address.changed': 'URL alterada',
  back: 'Voltar',
  forward: 'Avançar',
  reload: 'Recarregar',
  go: 'Ir',
  external: 'Abrir no navegador do sistema',
  'sandbox.disable': 'Desativar restrições de sandbox',
  'sandbox.enable': 'Restaurar restrições de sandbox',
  'sandbox.warning': 'As restrições de sandbox estão desativadas; a página pode navegar o aplicativo principal e usar downloads, diálogos modais e bloqueios de entrada.',
  start: 'Digite um endereço HTTP(S) para começar a navegar',
  loading: 'Abrindo…',
  'restore.previous': 'Aberto anteriormente',
  'restore.action': 'Restaurar página',
  'error.empty': 'Digite um endereço.',
  'error.invalid': 'Esse endereço é inválido ou longo demais.',
  'error.protocol': 'Somente endereços HTTP e HTTPS são suportados; use a Prévia de documentos para arquivos locais.',
  'error.credentials': 'Endereços não podem conter usuário ou senha.',
  'error.application-origin': 'O navegador embutido não pode abrir o próprio aplicativo CurupiraCode.',
  'load.failed': 'Não foi possível carregar a página; recarregue ou abra-a no navegador do sistema.',
  'load.failed.detail': 'Falha ao carregar a página ({code}): {description}',
  'address.unknown': 'A página navegou; este contêiner não consegue ler a nova URL.',
} satisfies LocaleDictOf<'sidebarBrowser'>
