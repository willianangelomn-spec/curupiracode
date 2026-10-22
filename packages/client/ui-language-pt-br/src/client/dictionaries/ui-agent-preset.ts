/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-agent-preset`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-agent-preset/client'

/** `settings.agentPreset` namespace, complete against its owning key set. */
export const settingsAgentPresetPtBr = {
  builtInGroup: 'Integradas',
  customGroup: 'Personalizadas',
  sectionIntro: 'Escolha as ferramentas do agente e como ele trabalha. Use o modo Padrão para tarefas do dia a dia ou o modo Criador para ampliar o CurupiraCode.',
  seatHint: 'Escolha o preset de agente para a nova tarefa',
  headerHint: 'O preset de agente escolhido quando esta tarefa começou',
  nav: 'Predefinições de agente',
  setDefault: 'Definir como padrão para novas tarefas',
  view: 'Ver configuração',
  presetStandardName: 'Modo padrão',
  presetStandardDescription: 'Trabalhe com código, arquivos e informações. Adequado para a maioria das tarefas, com busca, edição, comandos de terminal e outras ferramentas conforme a necessidade.',
  presetPtcName: 'Modo PTC',
  presetPtcDescription: 'Inclui todos os recursos do modo Padrão. Mais indicado para tarefas que chamam ferramentas em lote e depois filtram, organizam, deduplicam, contam ou resumem os resultados.',
  presetMinimalName: 'Modo mínimo',
  presetMinimalDescription: 'O agente usa um terminal e a leitura de imagens, com compactação de contexto. Útil para testar e comparar o desempenho básico.',
  presetCordisName: 'Modo Criador',
  presetCordisDescription: 'Personalize o CurupiraCode conversando. Deixe o agente escrever plugins que adicionam recursos ou interface, ou combine ferramentas e prompts para criar seu próprio modo.',
  inUse: 'Padrão para novas tarefas',
  noDescription: 'Sem descrição.',
  brokenBadge: 'Falha ao carregar',
  switchRefused: 'Não foi possível mudar para {name}: {reason}',
  standardUnavailable: 'O modo Padrão está indisponível. Restaure-o ou escolha outro modo disponível.',
  close: 'Fechar',
  creatorDraft: 'Deixe o agente me ajudar a criar um preset',
  createPlugin: 'Deixe o agente criar um plugin',
  createPluginDescription: 'Entre no modo Criador e faça seu próprio plugin do CurupiraCode',
  createPluginChecking: 'Verificando se o modo Criador está disponível',
  createPluginUnavailable: 'Indisponível no momento. Reabra este menu para tentar de novo',
  createPluginMissing: 'O modo Criador não está incluído nesta configuração',
} satisfies LocaleDictOf<'settings.agentPreset'>
