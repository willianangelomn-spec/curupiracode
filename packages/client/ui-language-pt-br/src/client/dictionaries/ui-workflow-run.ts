/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-workflow-run`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-workflow-run/src/client/index.ts'

/** `workflowRun` namespace, complete against its owning key set. */
export const workflowRunPtBr = {
  'run.title': '{name}',
  'run.members.one': '{count} membro',
  'run.members.other': '{count} membros',
  'run.empty': 'Nenhum membro iniciado',
  'phase.unassigned': 'Sem fase',
  'phase.empty': 'Nome de fase vazio',
  'statusCount.running': 'Em execução {count}',
  'statusCount.completed': 'Concluídos {count}',
  'statusCount.failed': 'Com falha {count}',
  'statusCount.cancelled': 'Cancelados {count}',
  'statusCount.interrupted': 'Interrompidos {count}',
  'member.empty': 'Nome de membro vazio',
  'member.open': 'Abrir {name}',
  'status.running': 'Em execução',
  'status.completed': 'Concluído',
  'status.failed': 'Falhou',
  'status.cancelled': 'Cancelado',
  'status.interrupted': 'Interrompido',
} satisfies LocaleDictOf<'workflowRun'>
