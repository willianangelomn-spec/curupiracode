/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-settings-plugin-inventory`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugin-inventory/client'

/** `settings.pluginInventory` namespace, complete against its owning key set. */
export const settingsPluginInventoryPtBr = {
  tab: 'Lista de plugins',
  loading: 'Lendo plugins…',
  clientSyncing: 'Sincronizando os plugins desta página…',
  clientSyncFailed: 'Alguns plugins não puderam ser sincronizados nesta página. A ativação no host não mudou.',
  clientSyncRetry: 'Tentar novamente nesta página',
  error: 'Os plugins estão temporariamente indisponíveis.',
  metadataError: 'Erro nos metadados do pacote: {error}',
  retry: 'Tentar novamente',
  search: 'Buscar plugins',
  empty: 'Nenhum plugin disponível.',
  emptySearch: 'Nenhum plugin correspondente.',
  presetTitle: 'Plugins da sessão',
  presetSubtitle: 'Compostos por sessão pelos presets de agente',
  switcherLabel: 'Escolha o preset de agente a inspecionar',
  presetOptionDefault: '{name} (padrão)',
  presetOptionBroken: '{name} (falhou ao carregar)',
  globalTitle: 'Plugins globais',
  globalSubtitle: 'Compartilhados pelo sistema e por todas as sessões',
  presetProvidedDetail: 'Desativado globalmente; os presets de agente o fornecem por sessão',
  enabledIn: 'Ativado em',
  matchesInOtherPresets: 'Mais {count} ocorrências em outros presets: ',
  enabledTag: 'Ativado',
  disabledTag: 'Desativado',
  conditionalTag: 'Condicional',
  presetEnabledTag: 'Via presets',
  failedTag: 'Falhou',
  moduleLabel: 'Módulo',
  fromPreset: 'De',
  condition: 'Desativado quando',
  configuration: 'Configuração',
  runtime: 'Status',
  unobserved: 'Parado',
  pending: 'Aguardando dependências',
  loadingPhase: 'Carregando',
  active: 'Em execução',
  failed: 'Falha ao iniciar',
  unloading: 'Desmontando',
} satisfies LocaleDictOf<'settings.pluginInventory'>
