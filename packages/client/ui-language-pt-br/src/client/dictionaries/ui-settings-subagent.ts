/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-settings-subagent`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-subagent/client'

/** `settings.subagent` namespace, complete against its owning key set. */
export const settingsSubagentPtBr = {
  overridden: 'Substituído',
  reset: 'Restaurar padrão',
  readOnly: 'Esta instalação armazena as configurações como somente leitura.',
  unavailable: 'Este plugin não está carregado, então não pode ser configurado agora.',
  save: 'Salvar',
  saving: 'Salvando…',
  saveFailed: 'A instalação não aceitou estes valores; eles foram mantidos para você corrigir.',
  subagentTitle: 'Subagente',
  subagentDescription: 'Defina profundidade de recursão, quantidade e modelos dos subagentes.',
  subagentLimitsTitle: 'Limites',
  subagentMaxDepth: 'Profundidade máxima de recursão',
  subagentDepthHelpLabel: 'Sobre a profundidade máxima de recursão',
  subagentDepthHelp: 'Limita quantos níveis de subagentes um agente pode criar.',
  subagentDepthZero: 'Desativar subagentes',
  subagentDepthOne: 'Somente o agente principal pode criar subagentes',
  subagentDepthOverride: 'Se uma ferramenta define a própria profundidade máxima de recursão, essa configuração prevalece.',
  subagentMaxActive: 'Limite de subagentes em paralelo',
  subagentCapacityHelpLabel: 'Sobre o limite de subagentes em paralelo',
  subagentCapacityHelp: 'Total de subagentes ativos sob o mesmo agente principal, em todos os níveis de recursão. O agente principal não conta. Novos pedidos de início são rejeitados quando o limite é atingido.',
  subagentDepthInvalid: 'Digite um número inteiro igual ou maior que 0.',
  subagentCapacityInvalid: 'Digite um número inteiro igual ou maior que 1.',
  subagentModelSelectionTitle: 'Seleção de modelo',
  subagentModelSelectionToggle: 'Permitir que os agentes escolham modelos para os subagentes',
  subagentModelSelectionChoose: 'Quando ativado, os agentes podem escolher provedor, modelo e esforço de raciocínio para cada subagente entre os modelos autorizados abaixo. Vale apenas para novas sessões.',
  subagentModelSelectionAllowed: 'Modelos que os agentes podem escolher',
  subagentModelSelectionLoading: 'Carregando modelos…',
  subagentModelSelectionLoadFailed: 'Não foi possível carregar os modelos.',
  subagentModelSelectionRetry: 'Tentar novamente',
  subagentModelSelectionPartial: 'Alguns provedores de modelos não puderam ser carregados; as escolhas salvas continuam removíveis.',
  subagentModelSelectionUnavailable: 'Indisponível no momento',
  subagentModelSelectionUnavailableGroup: 'Salvos, mas indisponíveis no momento',
  subagentModelSelectionEmpty: 'Nenhum provedor anuncia modelos no momento.',
  subagentModelSelectionRequired: 'Selecione pelo menos um modelo antes de salvar.',
  subagentModelSelectionConflict: 'As configurações mudaram em outro lugar. Descarte o rascunho e tente novamente.',
  subagentModelSelectionOff: 'Os subagentes usam os padrões configurados ou herdam o modelo do agente pai. As escolhas de modelo salvas são mantidas.',
} satisfies LocaleDictOf<'settings.subagent'>
