/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-permission-presets`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merges.
import type {} from '@deepseek-ai/dsh-client-ui-permission-presets/src/client/PermissionRow.tsx'
import type {} from '@deepseek-ai/dsh-client-ui-permission-presets/src/client/index.ts'

/** `permission.access` namespace, complete against its owning key set. */
export const permissionAccessPtBr = {
  mode: 'Modo de acesso, atual: {name}',
  close: 'Fechar',
  'preset.readOnly': 'Somente leitura',
  'preset.workspaceWrite': 'Escrita no trabalho',
  'preset.fullAccess': 'Acesso total',
  'confirm.title': 'Ativar acesso total?',
  'confirm.description': 'O acesso total reduz as etapas de confirmação e permite que o agente execute mais ações diretamente, incluindo operações sensíveis, alterações de arquivos ou comandos externos. Use-o apenas quando confiar na tarefa atual.',
  'confirm.acknowledge': 'Entendi os riscos e quero continuar',
  'confirm.cancel': 'Cancelar',
  'confirm.enable': 'Ativar acesso total',
  'auto.label': 'Revisão automática',
  'auto.badge': 'EXP',
  'auto.description': 'Executa sem sandbox após uma revisão experimental, feita pelo mesmo modelo, de cada chamada de ferramenta nativa e de cada chamada interna PTC.',
  'auto.confirm.title': 'Ativar a revisão automática (experimental)?',
  'auto.confirm.description': 'A revisão automática executa sem sandbox. Antes de cada chamada de ferramenta nativa e de cada chamada interna PTC, o mesmo modelo do agente atual avalia se deve permiti-la; você aprova ou rejeita cada chamada que ele negar. Este recurso é experimental, pode permitir ou negar ações por engano e consome tokens adicionais.',
  'auto.confirm.acknowledge': 'Entendo esses riscos e quero continuar',
  'auto.confirm.enable': 'Ativar revisão automática',
} satisfies LocaleDictOf<'permission.access'>

/** `settings.permission` namespace, complete against its owning key set. */
export const settingsPermissionPtBr = {
  title: 'Permissão',
  description: 'Escolha o modo de permissão padrão para novas sessões',
  loading: 'Carregando',
  unavailable: 'Indisponível',
  'preset.readOnly': 'Somente leitura',
  'preset.workspaceWrite': 'Escrita no trabalho',
  'preset.fullAccess': 'Acesso total',
  'confirm.title': 'Ativar acesso total?',
  'confirm.description': 'O acesso total permite que novas sessões reduzam etapas de confirmação e executem mais ações diretamente, incluindo operações sensíveis, alterações de arquivos ou comandos externos. Use-o apenas quando confiar nas tarefas seguintes.',
  'confirm.acknowledge': 'Entendi os riscos e quero continuar',
  'confirm.cancel': 'Cancelar',
  'confirm.enable': 'Ativar acesso total',
} satisfies LocaleDictOf<'settings.permission'>
