/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-settings-web-search`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-web-search/src/client/index.ts'

/** `settings.webSearch` namespace, complete against its owning key set. */
export const settingsWebSearchPtBr = {
  title: 'Busca na web',
  description: 'Configure o provedor de busca da DeepSeek.',
  useSearchApi: 'Usar a nova API Web Search',
  useSearchApiHint: 'Desativado por padrão: a busca passa pelo DeepSeek Messages. Para recursos e preços da nova API Web Search, consulte o ',
  searchGuide: 'guia de Search & Fetch',
  searchGuideUrl: 'https://api-docs.deepseek.com/guides/search',
  apiKey: 'Chave de API',
  apiKeyHint: 'Armazenada fora do arquivo de configurações. Deixe em branco para manter a chave atual.',
  apiKeySet: 'Há uma chave configurada.',
  apiKeyUnset: 'Nenhuma chave configurada; apenas conversas que usam um modelo da Conta DeepSeek podem buscar, pelo endpoint padrão.',
  baseUrl: 'URL base da API Messages',
  baseUrlHint: 'Inclua o prefixo da API, como https://api.deepseek.com/anthropic/v1. O provedor acrescenta /messages. Deixe em branco para restaurar o padrão.',
  searchApiBaseUrl: 'URL base da API Search / Fetch',
  searchApiBaseUrlHint: 'Inclua o prefixo da API, como https://api.deepseek.com/v1/tools. O provedor acrescenta /search ou /fetch. Deixe em branco para restaurar o padrão.',
  maxUses: 'Máximo de buscas por requisição',
  maxUsesHint: 'Quantas buscas o modelo auxiliar pode fazer em uma requisição Messages. Vale apenas para a API Messages.',
  count: 'Resultados por busca',
  countHint: 'Resultados retornados por consulta: um inteiro de 1 a 50, padrão 10. Controla a quantidade de resultados, não de chamadas de busca. O web_search não mantém mais fontes do que o próprio limite de resultados.',
  overridden: 'Substituído',
  reset: 'Restaurar padrão',
  readOnly: 'Esta instalação armazena as configurações como somente leitura.',
  unavailable: 'Este plugin não está carregado, então não pode ser configurado agora.',
  save: 'Salvar',
  saving: 'Salvando…',
  saveFailed: 'A instalação não aceitou estes valores; eles foram mantidos para você corrigir.',
  invalidNumber: 'Digite um número ou deixe em branco para usar o padrão.',
  invalidCount: 'Digite um inteiro de 1 a 50 ou deixe em branco para usar o padrão.',
} satisfies LocaleDictOf<'settings.webSearch'>
