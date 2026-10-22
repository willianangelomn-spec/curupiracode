/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-settings-shell`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-shell/src/client/index.ts'

/** `settings.shell` namespace, complete against its owning key set. */
export const settingsShellPtBr = {
  title: 'Shell',
  description: 'Limite quanto tempo cada comando pode executar e quanta saída pode produzir.',
  timeoutMs: 'Tempo limite do comando (ms)',
  timeoutMsHint: 'Quanto tempo um comando pode executar antes de ser encerrado.',
  maxOutputBytes: 'Limite de saída por fluxo (bytes)',
  maxOutputBytesHint: 'A saída além deste limite vai para um arquivo temporário em vez de ser perdida.',
  overridden: 'Substituído',
  reset: 'Restaurar padrão',
  readOnly: 'Esta instalação armazena as configurações como somente leitura.',
  unavailable: 'Este plugin não está carregado, então não pode ser configurado agora.',
  save: 'Salvar',
  saving: 'Salvando…',
  saveFailed: 'A instalação não aceitou estes valores; eles foram mantidos para você corrigir.',
  invalidNumber: 'Digite um número ou deixe em branco para usar o padrão.',
} satisfies LocaleDictOf<'settings.shell'>
