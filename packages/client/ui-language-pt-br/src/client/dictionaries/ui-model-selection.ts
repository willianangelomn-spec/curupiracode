/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-model-selection`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/src/client/index.ts'

/** `model` namespace, complete against its owning key set. */
export const modelPtBr = {
  'provider.account': 'Conta DeepSeek',
  'command.label': 'Modelo',
  'command.description': 'Selecionar o modelo desta conversa',
  'option.loadError': 'Falha ao carregar o catálogo: {message}',
  'trigger.fallback': 'Selecionar modelo',
  'trigger.loading': 'Carregando modelos…',
  'trigger.selectAria': 'Selecionar modelo',
  'trigger.aria': 'Selecionar modelo, atual {model}',
  'trigger.ariaEffort': 'Selecionar modelo, atual {model}, esforço de raciocínio {effort}',
  'menu.aria': 'Modelo e esforço de raciocínio',
  'menu.model': 'Modelo',
  'menu.effort': 'Esforço',
  'effort.providerDefault': 'Padrão',
  'status.loading': 'Atualizando a lista de modelos…',
  'error.action': 'Falha na operação do modelo: {message}',
  'error.sessionInUse': 'Esta sessão já está em uso, possivelmente por outra instância do CurupiraCode em execução (como curupiracode web ou o aplicativo de desktop). Feche as outras instâncias e tente novamente.',
  'action.reload': 'Recarregar',
  'warning.groupLoad': 'Falha ao carregar {name}: {message}',
  'search.placeholder': 'Buscar modelos…',
  'search.clear': 'Limpar busca',
  'search.empty': 'Nenhum modelo corresponde.',
  'empty.models': 'Nenhum modelo disponível.',
  'empty.efforts': 'Este modelo não oferece níveis de esforço de raciocínio.',
} satisfies LocaleDictOf<'model'>
