import { appendMacroEvent, finishMacro } from './macro.js'

const MENU_PAGE = 'curupira-page'
const MENU_SELECTION = 'curupira-selection'
const MACROS_KEY = 'browserMacros'
let macroWriteQueue = Promise.resolve()

// Opening the panel through `openPanelOnActionClick` bypasses action.onClicked
// in Chromium and therefore does not reliably grant activeTab. Own the action
// click so the grant and the tab recorded below describe the same user gesture.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined)

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined)
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_PAGE, title: 'Automatizar esta página com CurupiraCode', contexts: ['page'] })
    chrome.contextMenus.create({ id: MENU_SELECTION, title: 'Enviar seleção ao CurupiraCode', contexts: ['selection'] })
  })
})

function authorizeTab(tab, selection = '') {
  if (tab?.id === undefined) return
  void chrome.storage.session.set({
    authorizedTab: {
      tabId: tab.id,
      selection,
      time: Date.now(),
    },
  })
  // Keep this call directly inside the user-gesture listener. Awaiting storage
  // first can consume Chrome's transient permission to open the side panel.
  void chrome.sidePanel.open({ tabId: tab.id })
}

chrome.action.onClicked.addListener(tab => authorizeTab(tab))

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined || (info.menuItemId !== MENU_PAGE && info.menuItemId !== MENU_SELECTION)) return
  authorizeTab(tab, info.selectionText ?? '')
  void chrome.storage.session.set({
    pendingContext: {
      tabId: tab.id,
      selection: info.selectionText ?? '',
      time: Date.now(),
    },
  })
})

function queueMacroWrite(operation) {
  const pending = macroWriteQueue.then(operation, operation)
  macroWriteQueue = pending.catch(() => undefined)
  return pending
}

async function startMacro(message) {
  const url = new URL(message.url)
  if (!['http:', 'https:'].includes(url.protocol) || !Number.isInteger(message.tabId)) throw new Error('A aba da macro é inválida.')
  const recording = {
    tabId: message.tabId,
    origin: url.origin,
    name: String(message.name || 'Macro de formulário').trim().slice(0, 120),
    startedAt: Date.now(),
    updatedAt: Date.now(),
    pages: [],
  }
  await chrome.storage.session.set({ macroRecording: recording })
  return recording
}

async function recordMacroEvent(message, sender) {
  const { macroRecording } = await chrome.storage.session.get('macroRecording')
  if (!macroRecording || sender.tab?.id !== macroRecording.tabId) return { ignored: true }
  appendMacroEvent(macroRecording, message.event)
  await chrome.storage.session.set({ macroRecording })
  return { recorded: true }
}

async function saveFinishedMacro() {
  const { macroRecording } = await chrome.storage.session.get('macroRecording')
  if (!macroRecording) throw new Error('Nenhuma macro está sendo gravada.')
  const macro = finishMacro(macroRecording)
  const stored = await chrome.storage.local.get(MACROS_KEY)
  const macros = Array.isArray(stored[MACROS_KEY]) ? stored[MACROS_KEY] : []
  await chrome.storage.local.set({ [MACROS_KEY]: [macro, ...macros].slice(0, 50) })
  await chrome.storage.session.remove('macroRecording')
  return macro
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.source === 'curupira-content' && message.type === 'macro-event') {
    void queueMacroWrite(() => recordMacroEvent(message, sender))
      .then(value => sendResponse({ ok: true, value }))
      .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    return true
  }
  if (message?.source !== 'curupira-sidepanel') return false
  let operation
  if (message.type === 'macro-start') operation = () => startMacro(message)
  else if (message.type === 'macro-finish') operation = saveFinishedMacro
  else if (message.type === 'macro-cancel') operation = async () => { await chrome.storage.session.remove('macroRecording'); return {} }
  else return false
  void queueMacroWrite(operation)
    .then(value => sendResponse({ ok: true, value }))
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  return true
})

// A multi-page form destroys its content script on navigation. Reattach the
// recorder only to the same explicitly authorized tab and origin.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  void chrome.storage.session.get('macroRecording').then(async ({ macroRecording }) => {
    if (!macroRecording || macroRecording.tabId !== tabId || !tab.url) return
    let origin
    try { origin = new URL(tab.url).origin } catch { return }
    if (origin !== macroRecording.origin) return
    try {
      const injected = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['src/content.js'] })
      const frameIds = [...new Set(injected.map(result => result.frameId))]
      await Promise.all(frameIds.map(frameId => chrome.tabs.sendMessage(
        tabId,
        { source: 'curupira-sidepanel', type: 'macro-record-start' },
        { frameId },
      ).catch(() => undefined)))
    } catch {
      // The side panel reports a missing page when the user next interacts;
      // no broader host permission is requested as a fallback.
    }
  })
})

chrome.tabs.onRemoved.addListener(tabId => {
  void chrome.storage.session.get('macroRecording').then(({ macroRecording }) => {
    if (macroRecording?.tabId === tabId) return chrome.storage.session.remove('macroRecording')
  })
})
