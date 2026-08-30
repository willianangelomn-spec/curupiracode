/** `trajectory` namespace dictionaries (view tab label + toolbar strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'trajectory'

/** The trajectory dictionary key set (the source of truth for both locales). */
export type TrajectoryKey =
  | 'view.trajectory'
  | 'toolbar.aria'
  | 'toolbar.duration'
  | 'toolbar.useActualDuration'
  | 'toolbar.useEqualWidth'
  | 'toolbar.actualTime'
  | 'toolbar.turns'
  | 'toolbar.expandTurns'
  | 'toolbar.collapseTurns'
  | 'toolbar.calls'
  | 'toolbar.expandCalls'
  | 'toolbar.collapseCalls'
  | 'toolbar.search'
  | 'toolbar.searchPlaceholder'
  // Record-kind tags (ledger rows, inspector header, tooltips).
  | 'kind.system'
  | 'kind.user'
  | 'kind.context'
  | 'kind.compacted'
  | 'kind.message'
  | 'kind.tool'
  | 'kind.subtool'
  // Record/request status values.
  | 'status.failed'
  | 'status.pending'
  | 'status.completed'
  // Timing panels (assistant metrics and record/request timing).
  | 'timing.started'
  | 'timing.totalDuration'
  | 'timing.ttft'
  | 'timing.generation'
  | 'timing.throughput'
  | 'timing.duration'
  | 'timing.timingSource'
  | 'timing.sessionTimestamps'
  | 'timing.sessionTimestampsRunning'
  | 'timing.notAvailable'
  | 'timing.notRecorded'
  | 'timing.stepStartUnavailable'
  | 'timing.firstTokenUnavailable'
  | 'timing.outputTokensUnavailable'
  | 'timing.usageUnavailable'
  | 'timing.durationTooShort'
  | 'timing.showLocalTime'
  | 'timing.showUnixTimestamp'
  // Token and usage breakdowns.
  | 'usage.tokens'
  | 'usage.reasoning'
  | 'usage.content'
  | 'usage.notReported'
  | 'usage.input'
  | 'usage.cached'
  | 'usage.cacheCreated'
  | 'usage.other'
  | 'usage.output'
  | 'usage.thisRequest'
  | 'usage.sessionCumulative'
  // Request options payload.
  | 'options.notRecorded'
  // JsonTree accessibility labels.
  | 'json.requestOptions'
  | 'json.messageSource'
  | 'json.result'
  | 'json.payload'
  | 'json.toolParameters'
  // Tool schema panel.
  | 'schema.unavailable'
  | 'schema.parameters'
  // Message source labels.
  | 'source.notRecorded'
  | 'source.unknown'
  | 'source.user'
  | 'source.plugin'
  | 'source.pluginNamed'
  | 'source.goal'
  | 'source.goalRound'
  // Detail tabs.
  | 'tabs.systemPrompt'
  | 'tabs.tools'
  | 'tabs.diff'
  | 'tabs.summary'
  | 'tabs.options'
  | 'tabs.usage'
  | 'tabs.timing'
  | 'tabs.rawOutput'
  | 'tabs.preview'
  | 'tabs.raw'
  | 'tabs.source'
  | 'tabs.payload'
  | 'tabs.result'
  | 'tabs.schema'
  | 'tabs.requestTiming'
  // Inspector overview fields.
  | 'overview.status'
  | 'overview.purpose'
  | 'overview.compaction'
  | 'overview.provider'
  | 'overview.model'
  | 'overview.toolCalls'
  | 'overview.subtoolCalls'
  | 'overview.error'
  | 'overview.retry'
  | 'overview.retryScheduled'
  | 'overview.retryOf'
  | 'overview.retryDelay'
  | 'overview.compactedLink'
  | 'overview.assistantMessage'
  | 'overview.hierarchy'
  | 'overview.toolCallLink'
  // Turn/section labels in the ledger rail.
  | 'section.turn'
  | 'section.betweenTurns'
  // Request numbering labels.
  | 'request.number'
  | 'request.plain'
  | 'request.compactionSuffix'
  | 'request.compactionLocation'
  // Collapsed turn/assistant summaries.
  | 'summary.oneStep'
  | 'summary.steps'
  | 'summary.oneToolCall'
  | 'summary.toolCalls'
  // Misc ledger copy.
  | 'misc.loadingTrajectory'
  | 'misc.thinking'
  | 'misc.noContent'
  | 'misc.noPayloadCaptured'
  | 'misc.noResultCaptured'
  | 'misc.noToolsInRequest'
  | 'misc.noSystemPrompt'
  | 'misc.toolCallOnlyTag'
  | 'misc.toolCallOnlyLabel'
  | 'block.label'
  // Timeline lanes, tooltip, and empty state.
  | 'timeline.laneInput'
  | 'timeline.laneModel'
  | 'timeline.laneTools'
  | 'timeline.empty'
  | 'timeline.total'
  | 'timeline.startedAt'
  | 'timeline.ttftDecoding'
  | 'timeline.clickLoadEarlier'
  // Earlier-history boundary.
  | 'history.loadEarlier'
  | 'history.loadingEarlier'
  | 'history.loadingEarlierEllipsis'
  // Accessibility labels and hints.
  | 'a11y.eventDetails'
  | 'a11y.resizeEventDetails'
  | 'a11y.closeDetails'
  | 'a11y.detailsResizeHint'
  | 'a11y.openToolCallSummary'
  | 'a11y.openBlockToolCallSummary'
  | 'a11y.openImage'
  | 'a11y.timelineRoot'
  | 'a11y.timelineOverview'
  | 'a11y.collapsedTurnSummary'
  | 'a11y.collapsedAssistantSummary'
  | 'a11y.requestOnlyRow'
  | 'a11y.noContent'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The trajectory view tab label and toolbar strings. */
    'trajectory': TrajectoryKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<TrajectoryKey, string> = {
  'view.trajectory': '轨迹',
  'toolbar.aria': '轨迹工具栏',
  'toolbar.duration': 'Duration',
  'toolbar.useActualDuration': 'Use actual duration',
  'toolbar.useEqualWidth': 'Use equal-width operations',
  'toolbar.actualTime': '实际时间',
  'toolbar.turns': 'Turns',
  'toolbar.expandTurns': 'Expand turns',
  'toolbar.collapseTurns': 'Collapse turns',
  'toolbar.calls': 'Calls',
  'toolbar.expandCalls': 'Expand calls',
  'toolbar.collapseCalls': 'Collapse calls',
  'toolbar.search': '搜索轨迹',
  'toolbar.searchPlaceholder': '搜索',
  'kind.system': '系统',
  'kind.user': '用户',
  'kind.context': '上下文',
  'kind.compacted': '已压缩',
  'kind.message': '助手',
  'kind.tool': '工具',
  'kind.subtool': '子工具',
  'status.failed': '失败',
  'status.pending': '等待中',
  'status.completed': '已完成',
  'timing.started': '开始时间',
  'timing.totalDuration': '总耗时',
  'timing.ttft': 'TTFT',
  'timing.generation': '生成耗时',
  'timing.throughput': '吞吐量',
  'timing.duration': '耗时',
  'timing.timingSource': '计时来源',
  'timing.sessionTimestamps': '会话时间戳',
  'timing.sessionTimestampsRunning': '会话时间戳（进行中）',
  'timing.notAvailable': '不可用',
  'timing.notRecorded': '未记录',
  'timing.stepStartUnavailable': '步骤开始时间不可用',
  'timing.firstTokenUnavailable': '首个词元不可用',
  'timing.outputTokensUnavailable': '输出词元不可用',
  'timing.usageUnavailable': '用量不可用',
  'timing.durationTooShort': '时长过短',
  'timing.showLocalTime': '显示本地时间',
  'timing.showUnixTimestamp': '显示 Unix 时间戳',
  'usage.tokens': '词元',
  'usage.reasoning': '推理',
  'usage.content': '内容',
  'usage.notReported': '未上报用量',
  'usage.input': '输入',
  'usage.cached': '缓存读取',
  'usage.cacheCreated': '新建缓存',
  'usage.other': '其他',
  'usage.output': '输出',
  'usage.thisRequest': '本次请求',
  'usage.sessionCumulative': '会话累计',
  'options.notRecorded': '未记录选项',
  'json.requestOptions': '请求选项 JSON',
  'json.messageSource': '消息来源 JSON',
  'json.result': '结果 JSON',
  'json.payload': '载荷 JSON',
  'json.toolParameters': '{name} 参数 JSON',
  'schema.unavailable': 'Schema 不可用',
  'schema.parameters': '参数',
  'source.notRecorded': '未记录来源',
  'source.unknown': '未知',
  'source.user': '用户',
  'source.plugin': '插件',
  'source.pluginNamed': '插件 · {plugin}',
  'source.goal': '目标',
  'source.goalRound': '目标 · 第 {round} 轮',
  'tabs.systemPrompt': '系统提示词',
  'tabs.tools': '工具',
  'tabs.diff': 'Diff',
  'tabs.summary': '摘要',
  'tabs.options': '选项',
  'tabs.usage': '用量',
  'tabs.timing': '耗时',
  'tabs.rawOutput': '原始输出',
  'tabs.preview': '预览',
  'tabs.raw': '原始内容',
  'tabs.source': '来源',
  'tabs.payload': '载荷',
  'tabs.result': '结果',
  'tabs.schema': 'Schema',
  'tabs.requestTiming': '请求耗时',
  'overview.status': '状态',
  'overview.purpose': '用途',
  'overview.compaction': '压缩',
  'overview.provider': '提供商',
  'overview.model': '模型',
  'overview.toolCalls': '工具调用',
  'overview.subtoolCalls': '子工具调用',
  'overview.error': '错误',
  'overview.retry': '重试',
  'overview.retryScheduled': '已计划第 {number} 次',
  'overview.retryOf': '共 {total} 次',
  'overview.retryDelay': '重试延迟',
  'overview.compactedLink': '已压缩',
  'overview.assistantMessage': '助手消息',
  'overview.hierarchy': '层级',
  'overview.toolCallLink': '工具调用',
  'section.turn': '第 {turn} 轮',
  'section.betweenTurns': '轮次之间',
  'request.number': '请求 #{number}',
  'request.plain': '请求 {number}',
  'request.compactionSuffix': '请求 #{number} · 压缩',
  'request.compactionLocation': '压缩 · {location}',
  'summary.oneStep': '1 步',
  'summary.steps': '{count} 步',
  'summary.oneToolCall': '1 次工具调用',
  'summary.toolCalls': '{count} 次工具调用',
  'misc.loadingTrajectory': '正在加载轨迹…',
  'misc.thinking': '思考',
  'misc.noContent': '无内容',
  'misc.noPayloadCaptured': '未捕获载荷',
  'misc.noResultCaptured': '未捕获结果',
  'misc.noToolsInRequest': '此请求不包含工具',
  'misc.noSystemPrompt': '此请求不包含系统提示词',
  'misc.toolCallOnlyTag': '(仅工具调用)',
  'misc.toolCallOnlyLabel': '仅工具调用',
  'block.label': '块 #{number} {type}',
  'timeline.laneInput': '输入',
  'timeline.laneModel': '模型',
  'timeline.laneTools': '工具',
  'timeline.empty': '暂无计时数据',
  'timeline.total': '总计 {offset}',
  'timeline.startedAt': '开始于 {time}',
  'timeline.ttftDecoding': 'TTFT {ttft} · 解码 {decoding}',
  'timeline.clickLoadEarlier': '点击加载更早的历史',
  'history.loadEarlier': '加载更早的历史',
  'history.loadingEarlier': '正在加载更早的历史',
  'history.loadingEarlierEllipsis': '正在加载更早的历史…',
  'a11y.eventDetails': '事件详情',
  'a11y.resizeEventDetails': '调整事件详情大小',
  'a11y.closeDetails': '关闭详情',
  'a11y.detailsResizeHint': '拖动调整大小，双击重置。',
  'a11y.openToolCallSummary': '打开工具调用摘要',
  'a11y.openBlockToolCallSummary': '打开块 #{number} 的工具调用摘要',
  'a11y.openImage': '打开图片',
  'a11y.timelineRoot': '轨迹时间线',
  'a11y.timelineOverview': '时间线概览；水平拖动以聚焦事件',
  'a11y.collapsedTurnSummary': '已折叠的轮次摘要，{summary}',
  'a11y.collapsedAssistantSummary': '已折叠的助手摘要，{summary}',
  'a11y.requestOnlyRow': '请求 {number}，压缩',
  'a11y.noContent': '无内容',
}

/** English dictionary. */
export const en: Record<TrajectoryKey, string> = {
  'view.trajectory': 'Trajectory',
  'toolbar.aria': 'Trajectory toolbar',
  'toolbar.duration': 'Duration',
  'toolbar.useActualDuration': 'Use actual duration',
  'toolbar.useEqualWidth': 'Use equal-width operations',
  'toolbar.actualTime': 'Actual time',
  'toolbar.turns': 'Turns',
  'toolbar.expandTurns': 'Expand turns',
  'toolbar.collapseTurns': 'Collapse turns',
  'toolbar.calls': 'Calls',
  'toolbar.expandCalls': 'Expand calls',
  'toolbar.collapseCalls': 'Collapse calls',
  'toolbar.search': 'Search trajectory',
  'toolbar.searchPlaceholder': 'Search',
  'kind.system': 'SYSTEM',
  'kind.user': 'USER',
  'kind.context': 'CONTEXT',
  'kind.compacted': 'COMPACTED',
  'kind.message': 'ASSISTANT',
  'kind.tool': 'TOOL',
  'kind.subtool': 'SUBTOOL',
  'status.failed': 'Failed',
  'status.pending': 'Pending',
  'status.completed': 'Completed',
  'timing.started': 'Started',
  'timing.totalDuration': 'Total duration',
  'timing.ttft': 'TTFT',
  'timing.generation': 'Generation',
  'timing.throughput': 'Throughput',
  'timing.duration': 'Duration',
  'timing.timingSource': 'Timing source',
  'timing.sessionTimestamps': 'Session timestamps',
  'timing.sessionTimestampsRunning': 'Session timestamps (running)',
  'timing.notAvailable': 'Not available',
  'timing.notRecorded': 'Not recorded',
  'timing.stepStartUnavailable': 'Step start unavailable',
  'timing.firstTokenUnavailable': 'First token unavailable',
  'timing.outputTokensUnavailable': 'Output tokens unavailable',
  'timing.usageUnavailable': 'Usage unavailable',
  'timing.durationTooShort': 'Duration too short',
  'timing.showLocalTime': 'Show local time',
  'timing.showUnixTimestamp': 'Show Unix timestamp',
  'usage.tokens': 'Tokens',
  'usage.reasoning': 'Reasoning',
  'usage.content': 'Content',
  'usage.notReported': 'Usage not reported',
  'usage.input': 'Input',
  'usage.cached': 'Cached',
  'usage.cacheCreated': 'Cache created',
  'usage.other': 'Other',
  'usage.output': 'Output',
  'usage.thisRequest': 'This request',
  'usage.sessionCumulative': 'Session cumulative',
  'options.notRecorded': 'Options not recorded',
  'json.requestOptions': 'Request options JSON',
  'json.messageSource': 'Message source JSON',
  'json.result': 'Result JSON',
  'json.payload': 'Payload JSON',
  'json.toolParameters': '{name} parameters JSON',
  'schema.unavailable': 'Schema unavailable',
  'schema.parameters': 'Parameters',
  'source.notRecorded': 'Source not recorded',
  'source.unknown': 'Unknown',
  'source.user': 'User',
  'source.plugin': 'Plugin',
  'source.pluginNamed': 'Plugin · {plugin}',
  'source.goal': 'Goal',
  'source.goalRound': 'Goal · Round {round}',
  'tabs.systemPrompt': 'System Prompt',
  'tabs.tools': 'Tools',
  'tabs.diff': 'Diff',
  'tabs.summary': 'Summary',
  'tabs.options': 'Options',
  'tabs.usage': 'Usage',
  'tabs.timing': 'Timing',
  'tabs.rawOutput': 'Raw Output',
  'tabs.preview': 'Preview',
  'tabs.raw': 'Raw',
  'tabs.source': 'Source',
  'tabs.payload': 'Payload',
  'tabs.result': 'Result',
  'tabs.schema': 'Schema',
  'tabs.requestTiming': 'Request Timing',
  'overview.status': 'Status',
  'overview.purpose': 'Purpose',
  'overview.compaction': 'Compaction',
  'overview.provider': 'Provider',
  'overview.model': 'Model',
  'overview.toolCalls': 'Tool calls',
  'overview.subtoolCalls': 'Subtool calls',
  'overview.error': 'Error',
  'overview.retry': 'Retry',
  'overview.retryScheduled': 'Scheduled {number}',
  'overview.retryOf': 'of {total}',
  'overview.retryDelay': 'Retry delay',
  'overview.compactedLink': 'Compacted',
  'overview.assistantMessage': 'Assistant Message',
  'overview.hierarchy': 'Hierarchy',
  'overview.toolCallLink': 'Tool Call',
  'section.turn': 'Turn {turn}',
  'section.betweenTurns': 'Between turns',
  'request.number': 'Request #{number}',
  'request.plain': 'Request {number}',
  'request.compactionSuffix': 'Request #{number} · Compaction',
  'request.compactionLocation': 'Compaction · {location}',
  'summary.oneStep': '1 step',
  'summary.steps': '{count} steps',
  'summary.oneToolCall': '1 tool call',
  'summary.toolCalls': '{count} tool calls',
  'misc.loadingTrajectory': 'Loading trajectory…',
  'misc.thinking': 'Thinking',
  'misc.noContent': 'No content',
  'misc.noPayloadCaptured': 'No payload captured',
  'misc.noResultCaptured': 'No result captured',
  'misc.noToolsInRequest': 'No tools in this request',
  'misc.noSystemPrompt': 'No system prompt in this request',
  'misc.toolCallOnlyTag': '(tool call only)',
  'misc.toolCallOnlyLabel': 'Tool call only',
  'block.label': 'Block #{number} {type}',
  'timeline.laneInput': 'Input',
  'timeline.laneModel': 'Model',
  'timeline.laneTools': 'Tools',
  'timeline.empty': 'No timing data',
  'timeline.total': 'Total {offset}',
  'timeline.startedAt': 'Started {time}',
  'timeline.ttftDecoding': 'TTFT {ttft} · Decoding {decoding}',
  'timeline.clickLoadEarlier': 'Click to load earlier history',
  'history.loadEarlier': 'Load earlier history',
  'history.loadingEarlier': 'Loading earlier history',
  'history.loadingEarlierEllipsis': 'Loading earlier history…',
  'a11y.eventDetails': 'Event details',
  'a11y.resizeEventDetails': 'Resize event details',
  'a11y.closeDetails': 'Close details',
  'a11y.detailsResizeHint': 'Drag to resize. Double-click to reset.',
  'a11y.openToolCallSummary': 'Open tool call summary',
  'a11y.openBlockToolCallSummary': 'Open Block #{number} tool call summary',
  'a11y.openImage': 'Open image',
  'a11y.timelineRoot': 'Trajectory timeline',
  'a11y.timelineOverview': 'Timeline overview; drag horizontally to focus events',
  'a11y.collapsedTurnSummary': 'Collapsed turn summary, {summary}',
  'a11y.collapsedAssistantSummary': 'Collapsed assistant summary, {summary}',
  'a11y.requestOnlyRow': 'Request {number}, compaction',
  'a11y.noContent': 'no content',
}


/** Brazilian Portuguese dictionary, checked complete against the key-set source of truth. */
export const ptBR = {
  'view.trajectory': 'Trajetória',
  'toolbar.aria': 'Barra de ferramentas da trajetória',
  'toolbar.duration': 'Duração',
  'toolbar.useActualDuration': 'Usar duração real',
  'toolbar.useEqualWidth': 'Usar operações de largura igual',
  'toolbar.actualTime': 'Tempo real',
  'toolbar.turns': 'Turnos',
  'toolbar.expandTurns': 'Expandir turnos',
  'toolbar.collapseTurns': 'Recolher turnos',
  'toolbar.calls': 'Chamadas',
  'toolbar.expandCalls': 'Expandir chamadas',
  'toolbar.collapseCalls': 'Recolher chamadas',
  'toolbar.search': 'Pesquisar trajetória',
  'toolbar.searchPlaceholder': 'Pesquisar',
  'kind.system': 'SISTEMA',
  'kind.user': 'USUÁRIO',
  'kind.context': 'CONTEXTO',
  'kind.compacted': 'COMPACTADO',
  'kind.message': 'ASSISTENTE',
  'kind.tool': 'FERRAMENTA',
  'kind.subtool': 'SUBFERRAMENTA',
  'status.failed': 'Falhou',
  'status.pending': 'Pendente',
  'status.completed': 'Concluído',
  'timing.started': 'Início',
  'timing.totalDuration': 'Duração total',
  'timing.ttft': 'TTFT',
  'timing.generation': 'Geração',
  'timing.throughput': 'Vazão',
  'timing.duration': 'Duração',
  'timing.timingSource': 'Origem do tempo',
  'timing.sessionTimestamps': 'Timestamps da sessão',
  'timing.sessionTimestampsRunning': 'Timestamps da sessão (em andamento)',
  'timing.notAvailable': 'Indisponível',
  'timing.notRecorded': 'Não registrado',
  'timing.stepStartUnavailable': 'Início do passo indisponível',
  'timing.firstTokenUnavailable': 'Primeiro token indisponível',
  'timing.outputTokensUnavailable': 'Tokens de saída indisponíveis',
  'timing.usageUnavailable': 'Uso indisponível',
  'timing.durationTooShort': 'Duração curta demais',
  'timing.showLocalTime': 'Mostrar hora local',
  'timing.showUnixTimestamp': 'Mostrar timestamp Unix',
  'usage.tokens': 'Tokens',
  'usage.reasoning': 'Raciocínio',
  'usage.content': 'Conteúdo',
  'usage.notReported': 'Uso não informado',
  'usage.input': 'Entrada',
  'usage.cached': 'Em cache',
  'usage.cacheCreated': 'Cache criado',
  'usage.other': 'Outro',
  'usage.output': 'Saída',
  'usage.thisRequest': 'Esta solicitação',
  'usage.sessionCumulative': 'Acumulado da sessão',
  'options.notRecorded': 'Opções não registradas',
  'json.requestOptions': 'JSON das opções da solicitação',
  'json.messageSource': 'JSON da origem da mensagem',
  'json.result': 'JSON do resultado',
  'json.payload': 'JSON do payload',
  'json.toolParameters': 'Parâmetros JSON de {name}',
  'schema.unavailable': 'Schema indisponível',
  'schema.parameters': 'Parâmetros',
  'source.notRecorded': 'Origem não registrada',
  'source.unknown': 'Desconhecida',
  'source.user': 'Usuário',
  'source.plugin': 'Plugin',
  'source.pluginNamed': 'Plugin · {plugin}',
  'source.goal': 'Meta',
  'source.goalRound': 'Meta · rodada {round}',
  'tabs.systemPrompt': 'Prompt do sistema',
  'tabs.tools': 'Ferramentas',
  'tabs.diff': 'Diff',
  'tabs.summary': 'Resumo',
  'tabs.options': 'Opções',
  'tabs.usage': 'Uso',
  'tabs.timing': 'Tempos',
  'tabs.rawOutput': 'Saída bruta',
  'tabs.preview': 'Prévia',
  'tabs.raw': 'Bruto',
  'tabs.source': 'Origem',
  'tabs.payload': 'Payload',
  'tabs.result': 'Resultado',
  'tabs.schema': 'Schema',
  'tabs.requestTiming': 'Tempos da solicitação',
  'overview.status': 'Status',
  'overview.purpose': 'Finalidade',
  'overview.compaction': 'Compactação',
  'overview.provider': 'Provedor',
  'overview.model': 'Modelo',
  'overview.toolCalls': 'Chamadas de ferramenta',
  'overview.subtoolCalls': 'Chamadas de subferramenta',
  'overview.error': 'Erro',
  'overview.retry': 'Tentativas',
  'overview.retryScheduled': 'Agendada {number}',
  'overview.retryOf': 'de {total}',
  'overview.retryDelay': 'Atraso de nova tentativa',
  'overview.compactedLink': 'Compactado',
  'overview.assistantMessage': 'Mensagem do assistente',
  'overview.hierarchy': 'Hierarquia',
  'overview.toolCallLink': 'Chamada de ferramenta',
  'section.turn': 'Turno {turn}',
  'section.betweenTurns': 'Entre turnos',
  'request.number': 'Solicitação #{number}',
  'request.plain': 'Solicitação {number}',
  'request.compactionSuffix': 'Solicitação #{number} · Compactação',
  'request.compactionLocation': 'Compactação · {location}',
  'summary.oneStep': '1 passo',
  'summary.steps': '{count} passos',
  'summary.oneToolCall': '1 chamada de ferramenta',
  'summary.toolCalls': '{count} chamadas de ferramenta',
  'misc.loadingTrajectory': 'Carregando trajetória…',
  'misc.thinking': 'Pensando',
  'misc.noContent': 'Sem conteúdo',
  'misc.noPayloadCaptured': 'Nenhum payload capturado',
  'misc.noResultCaptured': 'Nenhum resultado capturado',
  'misc.noToolsInRequest': 'Nenhuma ferramenta nesta solicitação',
  'misc.noSystemPrompt': 'Nenhum prompt de sistema nesta solicitação',
  'misc.toolCallOnlyTag': '(apenas chamada de ferramenta)',
  'misc.toolCallOnlyLabel': 'Apenas chamada de ferramenta',
  'block.label': 'Bloco nº {number} {type}',
  'timeline.laneInput': 'Entrada',
  'timeline.laneModel': 'Modelo',
  'timeline.laneTools': 'Ferramentas',
  'timeline.empty': 'Sem dados de tempo',
  'timeline.total': 'Total {offset}',
  'timeline.startedAt': 'Início {time}',
  'timeline.ttftDecoding': 'TTFT {ttft} · Decodificação {decoding}',
  'timeline.clickLoadEarlier': 'Clique para carregar o histórico anterior',
  'history.loadEarlier': 'Carregar histórico anterior',
  'history.loadingEarlier': 'Carregando histórico anterior',
  'history.loadingEarlierEllipsis': 'Carregando histórico anterior…',
  'a11y.eventDetails': 'Detalhes do evento',
  'a11y.resizeEventDetails': 'Redimensionar detalhes do evento',
  'a11y.closeDetails': 'Fechar detalhes',
  'a11y.detailsResizeHint': 'Arraste para redimensionar. Clique duplo para redefinir.',
  'a11y.openToolCallSummary': 'Abrir resumo da chamada de ferramenta',
  'a11y.openBlockToolCallSummary': 'Abrir resumo da chamada de ferramenta do bloco nº {number}',
  'a11y.openImage': 'Abrir imagem',
  'a11y.timelineRoot': 'Linha do tempo da trajetória',
  'a11y.timelineOverview': 'Visão geral da linha do tempo; arraste na horizontal para focar eventos',
  'a11y.collapsedTurnSummary': 'Resumo de turno recolhido, {summary}',
  'a11y.collapsedAssistantSummary': 'Resumo do assistente recolhido, {summary}',
  'a11y.requestOnlyRow': 'Solicitação {number}, compactação',
  'a11y.noContent': 'sem conteúdo',
} satisfies Record<TrajectoryKey, string>
