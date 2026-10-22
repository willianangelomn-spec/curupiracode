/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-settings-agent-loop`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-agent-loop/client'

/** `settings.agentLoop` namespace, complete against its owning key set. */
export const settingsAgentLoopPtBr = {
  title: 'Loop do agente',
  description: 'Controle como o agente despacha chamadas de ferramentas.',
  maxParallel: 'Chamadas de ferramentas em paralelo',
  maxParallelHint: 'Limite de chamadas seguras para paralelismo executadas ao mesmo tempo em uma etapa.',
  overridden: 'Substituído',
  reset: 'Restaurar padrão',
  readOnly: 'Esta instalação armazena as configurações como somente leitura.',
  unavailable: 'Este plugin não está carregado, então não pode ser configurado agora.',
  save: 'Salvar',
  saving: 'Salvando…',
  saveFailed: 'A instalação não aceitou estes valores; eles foram mantidos para você corrigir.',
  invalidNumber: 'Digite um número ou deixe em branco para usar o padrão.',
} satisfies LocaleDictOf<'settings.agentLoop'>
