/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-commands`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'

/** `command` namespace, complete against its owning key set. */
export const commandPtBr = {
  'section.add': 'Adicionar',
  'section.commands': 'Comandos',
  'label.goal': 'Meta',
  'label.plan': 'Plano',
  'label.feedback': 'Feedback',
  'label.compact': 'Compactar',
  'label.permission': 'Permissão',
  'label.export': 'Exportar',
  'description.goal': 'Definir ou ver a meta de uma tarefa longa',
  'description.plan': 'Entrar ou sair do modo de plano',
  'description.feedback': 'Registrar feedback sobre esta sessão',
  'description.compact': 'Compactar o histórico antigo da conversa',
  'description.permission': 'Trocar o preset de permissão (modo de sandbox + política de aprovação)',
  'description.export': 'Baixar o registro desta sessão como arquivo ZIP',
  'token.goal': 'goal',
  'token.plan': 'plan',
  'token.feedback': 'feedback',
  'token.compact': 'compact',
  'token.permission': 'permission',
  'token.export': 'export',
  'search.placeholder': 'Pesquisar…',
  'search.aria': 'Filtrar opções',
  'status.loading': 'Carregando opções…',
  'status.applying': 'Aplicando…',
  'status.empty': 'Sem opções',
  'overlay.aria': '/{command} opções',
  'listbox.aria': '/{command} correspondências',
  'notice.attachmentsUnsupported': '/{command} não aceita anexos; remova-os primeiro',
} satisfies LocaleDictOf<'command'>
