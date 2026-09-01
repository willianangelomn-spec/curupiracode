import { CurupiraApi, DEFAULT_BASE_URL, normalizeBaseUrl } from './api.js'
import {
  actionLabel,
  buildChatPrompt,
  buildFormPrompt,
  buildPlannerPrompt,
  parsePlan,
  validateFormPlan,
  validatePlan,
} from './automation.js'
import { macroStats, validateMacro } from './macro.js'

const ui = Object.fromEntries([
  'connection', 'page-title', 'page-url', 'capture', 'task', 'plan', 'cancel', 'result', 'summary', 'actions',
  'risk-confirmation', 'allow-risk', 'execute', 'status', 'base-url', 'save-url', 'answer-form', 'review-help',
  'chat-tab', 'automation-tab', 'chat-view', 'automation-view', 'include-page', 'new-chat', 'chat-messages',
  'chat-form', 'chat-input', 'chat-context-label', 'chat-cancel', 'chat-send', 'chat-attach', 'chat-files', 'chat-attachments',
  'macro-name', 'macro-start', 'macro-finish', 'macro-cancel-recording', 'macro-recording-status', 'macro-select', 'macro-summary',
  'macro-replay', 'macro-export', 'macro-import', 'macro-delete', 'macro-file',
].map(id => [id, document.getElementById(id)]))

let snapshot
let plan
let activeTabId
let abortController
let chatAbortController
let chatSessionId
let chatMessages = []
let chatAttachments = []
let api
let macros = []
let macroRecording
let macroBusy = false

const MAX_CHAT_ATTACHMENTS = 5
const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md', 'markdown', 'html', 'htm'])

function fileExtension(name) {
  const match = /\.([^.]+)$/.exec(name.toLowerCase())
  return match?.[1] || ''
}

function attachmentKind(file) {
  if (IMAGE_TYPES.has(file.type)) return 'image'
  return DOCUMENT_EXTENSIONS.has(fileExtension(file.name)) ? 'document' : undefined
}

function renderChatAttachments() {
  ui['chat-attachments'].replaceChildren()
  ui['chat-attachments'].classList.toggle('hidden', chatAttachments.length === 0)
  chatAttachments.forEach((file, index) => {
    const chip = document.createElement('div')
    chip.className = 'attachment-chip'
    const label = document.createElement('span')
    label.textContent = `${attachmentKind(file) === 'image' ? 'Imagem' : 'Arquivo'} · ${file.name}`
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.setAttribute('aria-label', `Remover ${file.name}`)
    remove.textContent = '×'
    remove.addEventListener('click', () => {
      chatAttachments.splice(index, 1)
      renderChatAttachments()
    })
    chip.append(label, remove)
    ui['chat-attachments'].append(chip)
  })
}

function addChatAttachments(files) {
  for (const file of files) {
    const kind = attachmentKind(file)
    if (!kind) throw new Error(`O formato de “${file.name}” não é compatível.`)
    if (file.size === 0 || file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      throw new Error(`“${file.name}” precisa ter entre 1 byte e 20MB.`)
    }
    if (chatAttachments.length >= MAX_CHAT_ATTACHMENTS) throw new Error('Anexe no máximo 5 arquivos por mensagem.')
    chatAttachments.push(file)
  }
  renderChatAttachments()
}

async function fileBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function setStatus(message, tone = '') {
  ui.status.textContent = message
  ui.status.className = `status ${tone}`.trim()
}

function setBusy(busy) {
  ui.plan.disabled = busy
  ui['answer-form'].disabled = busy
  ui.capture.disabled = busy
  ui.cancel.classList.toggle('hidden', !busy)
}

function selectedMacro() {
  return macros.find(macro => macro.id === ui['macro-select'].value)
}

function renderMacroUi() {
  const selectedId = ui['macro-select'].value
  ui['macro-select'].replaceChildren()
  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = macros.length ? 'Escolha uma macro' : 'Nenhuma macro salva'
  ui['macro-select'].append(empty)
  for (const macro of macros) {
    const option = document.createElement('option')
    option.value = macro.id
    option.textContent = macro.name
    ui['macro-select'].append(option)
  }
  if (macros.some(macro => macro.id === selectedId)) ui['macro-select'].value = selectedId
  else if (macros.length === 1) ui['macro-select'].value = macros[0].id
  const selected = selectedMacro()
  if (selected) {
    const stats = macroStats(selected)
    ui['macro-summary'].textContent = `${stats.pages} etapa(s) · ${stats.actions} campo(s) · ${selected.origin}`
  } else {
    ui['macro-summary'].textContent = ''
  }
  const recording = Boolean(macroRecording)
  ui['macro-recording-status'].classList.toggle('recording', recording)
  ui['macro-recording-status'].textContent = recording
    ? `Gravando “${macroRecording.name}”. Preencha e navegue pelo formulário normalmente.`
    : 'Nenhuma gravação em andamento.'
  ui['macro-start'].disabled = recording || macroBusy
  ui['macro-finish'].disabled = !recording || macroBusy
  ui['macro-cancel-recording'].disabled = !recording || macroBusy
  ui['macro-replay'].disabled = !selected || recording || macroBusy
  ui['macro-delete'].disabled = !selected || macroBusy
  ui['macro-export'].disabled = !selected || macroBusy
  ui['macro-import'].disabled = recording || macroBusy
  ui['macro-select'].disabled = macroBusy
}

async function restoreMacros() {
  const stored = await chrome.storage.local.get('browserMacros')
  macros = (Array.isArray(stored.browserMacros) ? stored.browserMacros : []).flatMap(candidate => {
    try { return [validateMacro(candidate)] } catch { return [] }
  })
  const session = await chrome.storage.session.get('macroRecording')
  macroRecording = session.macroRecording
  renderMacroUi()
}

async function macroBackground(message) {
  const response = await chrome.runtime.sendMessage({ source: 'curupira-sidepanel', ...message })
  if (response?.ok !== true) throw new Error(response?.error || 'Falha ao processar a macro.')
  return response.value
}

async function startMacro() {
  const current = await capturePage()
  const tab = await activeTab()
  const name = ui['macro-name'].value.trim() || `Formulário: ${current.title || 'sem título'}`
  macroBusy = true
  renderMacroUi()
  try {
    macroRecording = await macroBackground({ type: 'macro-start', tabId: tab.id, url: current.url, name })
    const frames = await messageContentFrames(tab.id, { source: 'curupira-sidepanel', type: 'macro-record-start' })
    if (!frames.some(frame => frame.response?.ok === true)) throw new Error('Não foi possível iniciar a captura da página.')
    ui['macro-name'].value = ''
    setStatus('Gravação iniciada. Preencha todas as etapas e depois clique em Terminar macro.', 'success')
  } catch (error) {
    await macroBackground({ type: 'macro-cancel' }).catch(() => undefined)
    macroRecording = undefined
    throw error
  } finally {
    macroBusy = false
    renderMacroUi()
  }
}

async function finishMacroRecording() {
  macroBusy = true
  renderMacroUi()
  try {
    const tabId = macroRecording?.tabId
    if (Number.isInteger(tabId)) {
      await messageContentFrames(tabId, { source: 'curupira-sidepanel', type: 'macro-record-start' })
      await messageContentFrames(tabId, { source: 'curupira-sidepanel', type: 'macro-record-flush' })
    }
    const macro = await macroBackground({ type: 'macro-finish' })
    if (Number.isInteger(tabId)) {
      await messageContentFrames(tabId, { source: 'curupira-sidepanel', type: 'macro-record-stop' })
    }
    macroRecording = undefined
    await restoreMacros()
    ui['macro-select'].value = macro.id
    renderMacroUi()
    const stats = macroStats(macro)
    setStatus(`Macro salva com ${stats.pages} etapa(s) e ${stats.actions} campo(s).`, 'success')
  } finally {
    macroBusy = false
    renderMacroUi()
  }
}

async function cancelMacroRecording() {
  macroBusy = true
  renderMacroUi()
  try {
    const tabId = macroRecording?.tabId
    if (Number.isInteger(tabId)) {
      await messageContentFrames(tabId, { source: 'curupira-sidepanel', type: 'macro-record-stop' })
    }
    await macroBackground({ type: 'macro-cancel' })
    macroRecording = undefined
    setStatus('Gravação descartada. Você já pode iniciar outra macro.', 'success')
  } finally {
    macroBusy = false
    renderMacroUi()
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function findMacroFrame(tabId, page) {
  const frames = await messageContentFrames(tabId, {
    source: 'curupira-sidepanel',
    type: 'macro-match-step',
    actions: page.actions,
  })
  const ranked = frames.flatMap(({ frameId, response }) => {
    if (response?.ok !== true || !response.page?.url) return []
    let current
    let recorded
    try {
      current = new URL(response.page.url)
      recorded = new URL(page.url)
    } catch { return [] }
    if (current.origin !== recorded.origin) return []
    const completeness = response.total === 0 ? 0 : response.matched / response.total
    const score = completeness * 1000
      + response.matched * 20
      + (response.page.signature === page.signature ? 100 : 0)
      + (current.pathname === recorded.pathname ? 10 : 0)
    return [{ frameId, response, score }]
  }).sort((left, right) => right.score - left.score)
  if (ranked.length === 0 || (page.actions.length > 0 && ranked[0].response.matched === 0)) {
    throw new Error('Não encontrei os campos desta etapa em nenhum quadro autorizado da página.')
  }
  return ranked[0]
}

async function waitForMacroNavigation(tabId, previousKey, expectedOrigin, nextPage) {
  const deadline = Date.now() + 30000
  await delay(500)
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId)
    const url = tab.url || tab.pendingUrl
    if (url && new URL(url).origin !== expectedOrigin) throw new Error('A macro saiu do site autorizado e foi interrompida.')
    try {
      const frame = await findMacroFrame(tabId, nextPage)
      if (frame.response.page.key !== previousKey) return frame
    } catch {
      // The page can be between unload and load; retry until the bounded deadline.
    }
    await delay(500)
  }
  throw new Error('A próxima etapa não carregou em 30 segundos. A macro foi interrompida.')
}

async function replaySelectedMacro() {
  const macro = selectedMacro()
  if (!macro) throw new Error('Escolha uma macro para reproduzir.')
  const tab = await activeTab()
  const currentUrl = tab.url || tab.pendingUrl
  if (!currentUrl || new URL(currentUrl).origin !== macro.origin) {
    throw new Error(`Abra um formulário do site ${macro.origin} para usar esta macro.`)
  }
  macroBusy = true
  renderMacroUi()
  try {
    let filled = 0
    let preparedFrame
    for (let index = 0; index < macro.pages.length; index += 1) {
      setStatus(`Reproduzindo etapa ${index + 1} de ${macro.pages.length}…`)
      const frame = preparedFrame ?? await findMacroFrame(tab.id, macro.pages[index])
      preparedFrame = undefined
      const response = await chrome.tabs.sendMessage(tab.id, {
        source: 'curupira-sidepanel',
        type: 'macro-replay-step',
        actions: macro.pages[index].actions,
      }, { frameId: frame.frameId })
      if (response?.ok !== true) throw new Error(response?.error || `Falha na etapa ${index + 1}.`)
      const failures = response.results.filter(result => !result.ok)
      if (failures.length) throw new Error(`Etapa ${index + 1} interrompida: ${failures[0].error}.`)
      filled += response.results.filter(result => result.ok && result.kind !== 'advance').length
      if (index < macro.pages.length - 1) {
        if (!response.advanced) throw new Error(`A etapa ${index + 1} não possui um botão Próximo reconhecível.`)
        preparedFrame = await waitForMacroNavigation(tab.id, response.page.key, macro.origin, macro.pages[index + 1])
      }
    }
    setStatus(`${filled} campo(s) preenchido(s). Revise o formulário; o envio final ficou para você.`, 'success')
  } finally {
    macroBusy = false
    renderMacroUi()
  }
}

async function deleteSelectedMacro() {
  const macro = selectedMacro()
  if (!macro || !confirm(`Apagar a macro “${macro.name}”?`)) return
  macros = macros.filter(candidate => candidate.id !== macro.id)
  await chrome.storage.local.set({ browserMacros: macros })
  renderMacroUi()
  setStatus('Macro apagada.', 'success')
}

function exportSelectedMacro() {
  const macro = selectedMacro()
  if (!macro) return
  const blob = new Blob([`${JSON.stringify(macro, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${macro.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'curupira-macro'}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  setStatus('Macro exportada. O arquivo pode ser importado em outro computador.', 'success')
}

async function importMacroFile(file) {
  const parsed = JSON.parse(await file.text())
  const macro = validateMacro({ ...parsed, id: crypto.randomUUID(), createdAt: Date.now() })
  macros = [macro, ...macros].slice(0, 50)
  await chrome.storage.local.set({ browserMacros: macros })
  renderMacroUi()
  ui['macro-select'].value = macro.id
  renderMacroUi()
  setStatus(`Macro “${macro.name}” importada.`, 'success')
}

function switchView(view) {
  const chat = view === 'chat'
  ui['chat-view'].classList.toggle('hidden', !chat)
  ui['automation-view'].classList.toggle('hidden', chat)
  ui['chat-tab'].classList.toggle('active', chat)
  ui['automation-tab'].classList.toggle('active', !chat)
  ui['chat-tab'].setAttribute('aria-selected', String(chat))
  ui['automation-tab'].setAttribute('aria-selected', String(!chat))
  if (chat) ui['chat-input'].focus()
}

function renderChatMessages(messages, pending = false) {
  chatMessages = messages
  ui['chat-messages'].replaceChildren()
  if (messages.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'chat-empty'
    const title = document.createElement('strong')
    title.textContent = 'Converse com a página'
    const description = document.createElement('span')
    description.textContent = 'Peça um resumo, tire dúvidas ou continue uma conversa sem sair da aba.'
    empty.append(title, description)
    ui['chat-messages'].append(empty)
    return
  }
  for (const message of messages) {
    const row = document.createElement('article')
    row.className = `message ${message.role}`
    const label = document.createElement('span')
    label.className = 'message-label'
    label.textContent = message.role === 'user' ? 'Você' : 'Curupira'
    const body = document.createElement('div')
    body.className = 'message-body'
    body.textContent = message.text
    row.append(label, body)
    ui['chat-messages'].append(row)
  }
  if (pending) {
    const row = document.createElement('article')
    row.className = 'message assistant pending'
    const label = document.createElement('span')
    label.className = 'message-label'
    label.textContent = 'Curupira'
    const body = document.createElement('div')
    body.className = 'message-body'
    body.textContent = 'Pensando…'
    row.append(label, body)
    ui['chat-messages'].append(row)
  }
  requestAnimationFrame(() => { ui['chat-messages'].scrollTop = ui['chat-messages'].scrollHeight })
}

function setChatBusy(busy) {
  ui['chat-send'].disabled = busy
  ui['new-chat'].disabled = busy
  ui['chat-input'].disabled = busy
  ui['chat-attach'].disabled = busy
  ui['chat-cancel'].classList.toggle('hidden', !busy)
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id === undefined) throw new Error('Não foi possível identificar a aba atual.')
  const { authorizedTab } = await chrome.storage.session.get('authorizedTab')
  if (authorizedTab?.tabId !== tab.id) {
    throw new Error('Clique no ícone do CurupiraCode nesta aba para autorizá-la e tente novamente.')
  }
  const visibleUrl = tab.url || tab.pendingUrl
  if (visibleUrl && !/^https?:/.test(visibleUrl)) {
    throw new Error('Abra uma página http ou https. Páginas internas do navegador permanecem bloqueadas.')
  }
  return tab
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { source: 'curupira-sidepanel', type: 'capture' })
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content.js'] })
    } catch {
      throw new Error('O Chrome não autorizou esta página. Clique novamente no ícone do CurupiraCode e tente Ler página.')
    }
  }
}

async function contentFrameIds(tabId) {
  try {
    const injected = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['src/content.js'] })
    return [...new Set(injected.map(result => result.frameId))]
  } catch {
    await ensureContentScript(tabId)
    return [0]
  }
}

async function messageContentFrames(tabId, message) {
  const frameIds = await contentFrameIds(tabId)
  return await Promise.all(frameIds.map(async frameId => {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message, { frameId })
      return { frameId, response }
    } catch {
      return { frameId, response: undefined }
    }
  }))
}

async function capturePage() {
  const tab = await activeTab()
  activeTabId = tab.id
  await ensureContentScript(tab.id)
  const response = await chrome.tabs.sendMessage(tab.id, { source: 'curupira-sidepanel', type: 'capture' })
  if (response?.ok !== true) throw new Error(response?.error || 'Não foi possível ler a página.')
  snapshot = response.snapshot
  ui['page-title'].textContent = snapshot.title || tab.title || 'Página sem título'
  ui['page-url'].textContent = snapshot.url
  setStatus(`${snapshot.elements.length} elementos interativos encontrados.`, 'success')
  return snapshot
}

function selectedActions() {
  if (!plan) return []
  return plan.actions
    .filter(action => action.approved !== false)
    .map(({ approved: _approved, ...action }) => action)
}

function refreshPlanApproval() {
  const selected = selectedActions()
  const hasSelectedRisk = selected.some(action => action.risk)
  ui['risk-confirmation'].classList.toggle('hidden', !hasSelectedRisk)
  if (!hasSelectedRisk) ui['allow-risk'].checked = false
  ui.execute.disabled = selected.length === 0
}

function createAnswerEditor(action, element) {
  if (action.type === 'fill') {
    const editor = document.createElement(action.value.length > 70 ? 'textarea' : 'input')
    if (editor instanceof HTMLTextAreaElement) editor.rows = 3
    else editor.type = 'text'
    editor.value = action.value
    editor.maxLength = element?.maxLength || 5000
    editor.className = 'answer-editor'
    editor.setAttribute('aria-label', `Resposta para ${element?.label || action.elementId}`)
    editor.addEventListener('input', () => { action.value = editor.value })
    return editor
  }
  if (action.type === 'select') {
    const editor = document.createElement('select')
    editor.className = 'answer-editor'
    editor.setAttribute('aria-label', `Resposta para ${element?.label || action.elementId}`)
    for (const option of element?.options ?? []) {
      const item = document.createElement('option')
      item.value = option.value
      item.textContent = option.label || option.value
      item.selected = option.value === action.value
      editor.append(item)
    }
    editor.addEventListener('change', () => { action.value = editor.value })
    return editor
  }
  if (action.type === 'check') {
    const editor = document.createElement('select')
    editor.className = 'answer-editor'
    editor.setAttribute('aria-label', `Resposta para ${element?.label || action.elementId}`)
    for (const [value, label] of [['true', 'Marcar'], ['false', 'Desmarcar']]) {
      const item = document.createElement('option')
      item.value = value
      item.textContent = label
      item.selected = action.value === (value === 'true')
      editor.append(item)
    }
    editor.addEventListener('change', () => { action.value = editor.value === 'true' })
    return editor
  }
}

function renderPlan(nextPlan) {
  plan = nextPlan
  ui.summary.textContent = plan.summary
  ui.actions.replaceChildren()
  for (const action of plan.actions) {
    action.approved = action.confidence !== 'low'
    const element = action.elementId ? snapshot.elements.find(candidate => candidate.id === action.elementId) : undefined
    const item = document.createElement('li')
    const heading = document.createElement('div')
    heading.className = 'action-heading'
    const approval = document.createElement('input')
    approval.type = 'checkbox'
    approval.checked = action.approved
    approval.setAttribute('aria-label', 'Aprovar esta ação')
    const copy = document.createElement('div')
    copy.className = 'action-copy'
    const title = document.createElement('strong')
    title.textContent = action.type === 'fill' || action.type === 'select'
      ? (element?.question || element?.label || action.elementId)
      : actionLabel(action, snapshot.elements)
    copy.append(title)
    if (action.reason) {
      const reason = document.createElement('span')
      reason.className = 'action-reason'
      reason.textContent = action.reason
      copy.append(reason)
    }
    heading.append(approval, copy)
    item.append(heading)
    approval.addEventListener('change', () => {
      action.approved = approval.checked
      item.classList.toggle('disabled-action', !approval.checked)
      refreshPlanApproval()
    })
    item.classList.toggle('disabled-action', !approval.checked)
    const editor = createAnswerEditor(action, element)
    if (editor) item.append(editor)
    if (action.confidence) {
      const confidence = document.createElement('span')
      confidence.className = `confidence ${action.confidence}`
      confidence.textContent = action.confidence === 'high' ? 'CONFIANÇA ALTA' : action.confidence === 'medium' ? 'CONFIANÇA MÉDIA' : 'REVISAR: CONFIANÇA BAIXA'
      item.append(confidence)
    }
    if (action.risk) {
      item.classList.add('risk')
      const badge = document.createElement('span')
      badge.className = 'risk-badge'
      badge.textContent = 'CONFIRMAÇÃO EXTRA'
      item.append(badge)
    }
    ui.actions.append(item)
  }
  ui['review-help'].classList.toggle('hidden', plan.mode !== 'form')
  ui['allow-risk'].checked = false
  ui.execute.textContent = plan.mode === 'form' ? 'Preencher respostas aprovadas' : 'Executar ações aprovadas'
  ui.execute.classList.toggle('hidden', plan.actions.length === 0)
  ui.result.classList.remove('hidden')
  refreshPlanApproval()
}

async function planTask() {
  const task = ui.task.value.trim()
  if (task === '') throw new Error('Descreva a tarefa antes de planejar.')
  setBusy(true)
  ui.result.classList.add('hidden')
  abortController = new AbortController()
  try {
    const current = await capturePage()
    setStatus('Curupira está preparando uma prévia segura…')
    const response = await api.plan(buildPlannerPrompt(task, current), current.title || 'Página', abortController.signal)
    const parsed = parsePlan(response.text)
    renderPlan(validatePlan(parsed, current.elements))
    setStatus(`Plano pronto e registrado na conversa ${response.sessionId.slice(0, 8)}. Revise antes de executar.`, 'success')
  } finally {
    abortController = undefined
    setBusy(false)
  }
}

async function answerForm() {
  setBusy(true)
  ui.result.classList.add('hidden')
  abortController = new AbortController()
  try {
    const current = await capturePage()
    setStatus('Curupira está analisando as perguntas sem enviar o formulário…')
    const response = await api.plan(buildFormPrompt(ui.task.value, current), current.title || 'Formulário', abortController.signal)
    const parsed = parsePlan(response.text)
    renderPlan(validateFormPlan(parsed, current.elements))
    setStatus('Respostas prontas. Edite, desmarque o que não quiser e só então preencha a página.', 'success')
  } finally {
    abortController = undefined
    setBusy(false)
  }
}

async function executePlan() {
  if (!plan || !snapshot || activeTabId === undefined) throw new Error('Prepare um plano antes de executar.')
  const actions = selectedActions()
  if (actions.length === 0) throw new Error('Aprove ao menos uma ação antes de executar.')
  if (actions.some(action => action.risk) && ui['allow-risk'].checked !== true) throw new Error('Confirme as ações sensíveis antes de executar.')
  const tab = await activeTab()
  if (tab.id !== activeTabId) throw new Error('A aba mudou desde a captura. Leia a página e planeje novamente.')
  ui.execute.disabled = true
  try {
    const response = await chrome.tabs.sendMessage(activeTabId, {
      source: 'curupira-sidepanel',
      type: 'execute',
      actions,
      expectedUrl: snapshot.url,
      allowHighRisk: actions.some(action => action.risk) && ui['allow-risk'].checked,
    })
    if (response?.ok !== true) throw new Error(response?.error || 'A execução falhou.')
    const succeeded = response.results.filter(result => result.ok).length
    const failure = response.results.find(result => !result.ok)
    if (failure) throw new Error(`${succeeded} ação(ões) executada(s); interrompido: ${failure.error}.`)
    setStatus(`${succeeded} ação(ões) executada(s). Confira a página antes de continuar.`, 'success')
    ui.result.classList.add('hidden')
    plan = undefined
  } finally {
    ui.execute.disabled = false
  }
}

async function restoreChat() {
  const stored = await chrome.storage.local.get('chatSessionId')
  chatSessionId = typeof stored.chatSessionId === 'string' ? stored.chatSessionId : undefined
  if (!chatSessionId) {
    renderChatMessages([])
    return
  }
  try {
    renderChatMessages(await api.history(chatSessionId))
  } catch {
    chatSessionId = undefined
    await chrome.storage.local.remove('chatSessionId')
    renderChatMessages([])
  }
}

async function sendChat() {
  const message = ui['chat-input'].value.trim()
  if (message === '' && chatAttachments.length === 0) throw new Error('Escreva uma mensagem ou anexe um arquivo antes de enviar.')
  const attached = [...chatAttachments]
  setChatBusy(true)
  ui['chat-input'].value = ''
  const attachedLabel = attached.length ? `\n\n📎 ${attached.map(file => file.name).join(', ')}` : ''
  const optimistic = [...chatMessages, { role: 'user', text: `${message || 'Analisar arquivos anexados'}${attachedLabel}` }]
  renderChatMessages(optimistic, true)
  chatAbortController = new AbortController()
  try {
    const pageContext = ui['include-page'].checked ? await capturePage() : undefined
    setStatus(attached.length ? 'Preparando anexos no Curupira local…' : 'Curupira está respondendo…')
    const images = []
    const documents = []
    for (const file of attached) {
      const data = await fileBase64(file)
      if (attachmentKind(file) === 'image') {
        images.push({ type: 'image', mediaType: file.type, data, name: file.name })
      } else {
        documents.push(await api.ingestDocument({ name: file.name, data, format: fileExtension(file.name) }, chatAbortController.signal))
      }
    }
    setStatus('Curupira está respondendo…')
    const prompt = buildChatPrompt(message, pageContext, documents)
    const response = await api.chat(
      chatSessionId,
      [...images, { type: 'text', text: prompt }],
      pageContext?.title || attached[0]?.name || 'Conversa',
      chatAbortController.signal,
    )
    chatSessionId = response.sessionId
    await chrome.storage.local.set({ chatSessionId })
    renderChatMessages(response.messages)
    chatAttachments = []
    renderChatAttachments()
    setStatus('Resposta concluída.', 'success')
  } catch (error) {
    renderChatMessages(optimistic)
    if (chatAbortController.signal.aborted) setStatus('Resposta cancelada.', 'error')
    else throw error
  } finally {
    chatAbortController = undefined
    setChatBusy(false)
    ui['chat-input'].focus()
  }
}

async function newChat() {
  if (chatAbortController) return
  chatSessionId = undefined
  await chrome.storage.local.remove('chatSessionId')
  renderChatMessages([])
  chatAttachments = []
  renderChatAttachments()
  setStatus('Nova conversa pronta.', 'success')
  ui['chat-input'].focus()
}

async function connect() {
  const stored = await chrome.storage.local.get('baseUrl')
  const baseUrl = stored.baseUrl || DEFAULT_BASE_URL
  ui['base-url'].value = baseUrl
  api = new CurupiraApi(baseUrl)
  try {
    await api.ping()
    ui.connection.className = 'connection online'
    setStatus('Conectado ao CurupiraCode local.', 'success')
    await Promise.all([restoreChat(), restoreMacros()])
  } catch (error) {
    ui.connection.className = 'connection offline'
    setStatus(`CurupiraCode local indisponível: ${error instanceof Error ? error.message : String(error)}`, 'error')
    await restoreMacros().catch(() => undefined)
  }
}

ui.capture.addEventListener('click', () => void capturePage().catch(error => setStatus(error.message, 'error')))
ui['chat-tab'].addEventListener('click', () => switchView('chat'))
ui['automation-tab'].addEventListener('click', () => switchView('automation'))
ui['chat-form'].addEventListener('submit', event => {
  event.preventDefault()
  void sendChat().catch(error => setStatus(error.message, 'error'))
})
ui['chat-input'].addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    ui['chat-form'].requestSubmit()
  }
})
ui['include-page'].addEventListener('change', () => {
  ui['chat-context-label'].textContent = ui['include-page'].checked ? 'A página será incluída' : 'Conversa sem página'
})
ui['new-chat'].addEventListener('click', () => void newChat())
ui['chat-cancel'].addEventListener('click', () => chatAbortController?.abort(new DOMException('Resposta cancelada.', 'AbortError')))
ui['chat-attach'].addEventListener('click', () => ui['chat-files'].click())
ui['chat-files'].addEventListener('change', () => {
  const files = [...ui['chat-files'].files]
  ui['chat-files'].value = ''
  try { addChatAttachments(files) } catch (error) { setStatus(error.message, 'error') }
})
ui.plan.addEventListener('click', () => void planTask().catch(error => setStatus(error.message, 'error')))
ui['answer-form'].addEventListener('click', () => void answerForm().catch(error => setStatus(error.message, 'error')))
ui['macro-start'].addEventListener('click', () => void startMacro().catch(error => setStatus(error.message, 'error')))
ui['macro-finish'].addEventListener('click', () => void finishMacroRecording().catch(error => setStatus(error.message, 'error')))
ui['macro-cancel-recording'].addEventListener('click', () => void cancelMacroRecording().catch(error => setStatus(error.message, 'error')))
ui['macro-replay'].addEventListener('click', () => void replaySelectedMacro().catch(error => setStatus(error.message, 'error')))
ui['macro-delete'].addEventListener('click', () => void deleteSelectedMacro().catch(error => setStatus(error.message, 'error')))
ui['macro-export'].addEventListener('click', exportSelectedMacro)
ui['macro-import'].addEventListener('click', () => ui['macro-file'].click())
ui['macro-file'].addEventListener('change', () => {
  const [file] = ui['macro-file'].files
  ui['macro-file'].value = ''
  if (file) void importMacroFile(file).catch(error => setStatus(`Não foi possível importar: ${error.message}`, 'error'))
})
ui['macro-select'].addEventListener('change', renderMacroUi)
ui.cancel.addEventListener('click', () => abortController?.abort(new DOMException('Planejamento cancelado.', 'AbortError')))
ui.execute.addEventListener('click', () => void executePlan().catch(error => setStatus(error.message, 'error')))
ui['save-url'].addEventListener('click', () => void (async () => {
  try {
    const value = normalizeBaseUrl(ui['base-url'].value)
    await chrome.storage.local.set({ baseUrl: value })
    await connect()
  } catch (error) {
    setStatus(error.message, 'error')
  }
})())
document.querySelectorAll('[data-task]').forEach(button => button.addEventListener('click', () => {
  ui.task.value = button.dataset.task
  ui.task.focus()
}))

void chrome.storage.session.get('pendingContext').then(({ pendingContext }) => {
  if (pendingContext?.selection) ui['chat-input'].value = `Explique esta seleção em português:\n\n${pendingContext.selection}`
  return chrome.storage.session.remove('pendingContext')
}).then(connect)
