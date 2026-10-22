/** pt-BR dictionaries for the namespaces owned by `@deepseek-ai/dsh-client-ui-jobs`. */

import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the owning package's LocaleNamespaceMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-jobs/client'

/** `job` namespace, complete against its owning key set. */
export const jobPtBr = {
  'count.live.one': '{count} job em segundo plano em execução',
  'count.live.other': '{count} jobs em segundo plano em execução',
  'count.idle.one': '{count} job em segundo plano',
  'count.idle.other': '{count} jobs em segundo plano',
  'list.aria': 'Jobs em segundo plano',
  'section.live': 'Em execução',
  'section.settledCount': 'Concluídas {count}',
  'section.clear': 'Limpar',
  'row.expandAria': 'Mostrar saída ao vivo de {label}',
  'row.collapseAria': 'Ocultar saída ao vivo de {label}',
  'kill.stop': 'Parar tarefa {label}',
  'kill.confirm': 'Clique de novo para confirmar',
  'kill.confirmAction': 'Confirmar parada',
  'kill.failed': 'Falha ao parar',
  'status.running': 'em execução',
  'status.stopping': 'encerrando',
  'status.completed': 'concluído',
  'status.killed': 'cancelado',
  'status.failed': 'falhou',
  'duration.seconds': '{seconds}s',
  'duration.minutes': '{minutes}m {seconds}s',
  'duration.hours': '{hours}h {minutes}m',
  'duration.title.live': 'Em execução há {duration}',
  'duration.title.done': 'Levou {duration}',
  'output.gap': '… saída anterior descartada …',
  'output.error': 'fluxo de saída ao vivo interrompido: {error}',
  'terminal.signal': 'sinal {signal}',
  'terminal.exitCode': 'saída {code}',
  'terminal.noExitCode': 'sem código de saída',
  'terminal.commandLine': 'Linha de comando {n}',
  'terminal.running': 'executando',
  'terminal.failed': 'falhou',
  'terminal.done': 'concluído',
  'terminal.copy': 'Copiar',
  'terminal.copied': 'Copiado',
  'terminal.noOutput': '(sem saída)',
  'terminal.collapse': 'Recolher',
  'terminal.collapseAria': 'Recolher saída',
  'terminal.expand': 'Mostrar mais {n} linhas',
  'terminal.expandAria': 'Expandir {n} linhas de saída recolhidas',
} satisfies LocaleDictOf<'job'>
