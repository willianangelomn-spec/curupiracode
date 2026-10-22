/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-sidebar-files`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-files/client'

/** `sidebarFiles` namespace, complete against its owning key set. */
export const sidebarFilesPtBr = {
  'shortcut.noSession': 'Selecione uma sessão primeiro',
  'type.label': 'Arquivos',
  'guide.title': 'Arquivos do workspace',
  'guide.description': 'Navegue pelos arquivos do workspace desta sessão',
  loading: 'Lendo…',
  empty: 'Diretório vazio',
  truncated: 'Itens demais; apenas parte deles é exibida.',
  noWorkspace: 'Esta sessão não tem diretório de workspace.',
  reload: 'Recarregar',
  autoRefresh: 'Atualização automática',
  'autoRefresh.enable': 'Ativar atualização automática',
  'autoRefresh.disable': 'Desativar atualização automática',
  'entry.other': 'Não é um arquivo nem um diretório, então não pode ser aberto.',
  'error.notFound': 'Esse diretório não existe mais. Ele pode ter sido movido ou excluído.',
  'error.outsideWorkspace': 'Esse diretório está fora do workspace, então a barra lateral não vai lê-lo.',
  'error.notDirectory': 'Isso não é um diretório.',
  'error.unavailable': 'Falha na leitura: {message}',
} satisfies LocaleDictOf<'sidebarFiles'>
