export const MACRO_SCHEMA_VERSION = 1
export const MAX_MACRO_PAGES = 30
export const MAX_MACRO_ACTIONS = 500

const ACTION_KINDS = new Set(['fill', 'select', 'check', 'advance'])

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedText(value, max, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function sanitizeLocator(value) {
  if (!isRecord(value)) throw new Error('A macro contém um localizador inválido.')
  const locator = {
    tag: boundedText(value.tag, 30).toLowerCase(),
    type: boundedText(value.type, 40).toLowerCase(),
    id: boundedText(value.id, 200),
    name: boundedText(value.name, 200),
    ariaLabel: boundedText(value.ariaLabel, 300),
    placeholder: boundedText(value.placeholder, 300),
    label: boundedText(value.label, 500),
    question: boundedText(value.question, 700),
    text: boundedText(value.text, 300),
    ordinal: Number.isInteger(value.ordinal) && value.ordinal >= 0 && value.ordinal < 500 ? value.ordinal : 0,
  }
  if (!locator.tag || ![locator.id, locator.name, locator.ariaLabel, locator.placeholder, locator.label, locator.question, locator.text].some(Boolean)) {
    throw new Error('A macro contém um campo que não pode ser reconhecido com segurança.')
  }
  return locator
}

function sanitizeAction(value) {
  if (!isRecord(value) || !ACTION_KINDS.has(value.kind)) throw new Error('A macro contém uma ação desconhecida.')
  const action = { kind: value.kind, locator: sanitizeLocator(value.locator) }
  if (value.kind === 'check') {
    if (typeof value.value !== 'boolean') throw new Error('A macro contém uma marcação inválida.')
    action.value = value.value
  } else if (value.kind !== 'advance') {
    if (typeof value.value !== 'string' || value.value.length > 10000) throw new Error('A macro contém um valor inválido.')
    action.value = value.value
    if (typeof value.optionLabel === 'string') action.optionLabel = value.optionLabel.slice(0, 500)
  }
  return action
}

function sanitizePage(value, expectedOrigin) {
  if (!isRecord(value)) throw new Error('A macro contém uma etapa inválida.')
  const url = new URL(boundedText(value.url, 3000))
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== expectedOrigin) {
    throw new Error('Todas as etapas da macro precisam pertencer ao mesmo site.')
  }
  const actions = Array.isArray(value.actions) ? value.actions.map(sanitizeAction) : []
  return {
    key: boundedText(value.key, 500),
    url: url.toString(),
    title: boundedText(value.title, 500),
    signature: boundedText(value.signature, 200),
    actions,
  }
}

/** Validate imported or persisted data before it reaches a page. */
export function validateMacro(value) {
  if (!isRecord(value) || value.schemaVersion !== MACRO_SCHEMA_VERSION) throw new Error('Versão de macro incompatível.')
  const origin = new URL(boundedText(value.origin, 3000)).origin
  if (!/^https?:\/\//.test(origin)) throw new Error('A macro não pertence a um site HTTP válido.')
  const pages = Array.isArray(value.pages) ? value.pages.map(page => sanitizePage(page, origin)) : []
  // The last recorded transition may be the form's final submission. A macro
  // only advances when another recorded page proves that the click was an
  // intermediate step.
  const lastPage = pages.at(-1)
  if (lastPage) lastPage.actions = lastPage.actions.filter(action => action.kind !== 'advance')
  const actionCount = pages.reduce((total, page) => total + page.actions.length, 0)
  if (pages.length === 0 || actionCount === 0) {
    throw new Error('Nenhum campo compatível foi capturado. Recarregue a extensão e tente novamente; formulários protegidos em quadros externos podem exigir permissão própria.')
  }
  if (pages.length > MAX_MACRO_PAGES || actionCount > MAX_MACRO_ACTIONS) throw new Error('A macro ultrapassa o limite de segurança.')
  return {
    schemaVersion: MACRO_SCHEMA_VERSION,
    id: boundedText(value.id, 100) || crypto.randomUUID(),
    name: boundedText(value.name, 120) || 'Macro sem nome',
    origin,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
    pages,
  }
}

function locatorIdentity(locator) {
  return [locator.tag, locator.type, locator.id, locator.name, locator.ariaLabel, locator.label, locator.question, locator.ordinal].join('|')
}

/** Merge noisy DOM input events into one final value per field and page. */
export function appendMacroEvent(recording, event) {
  if (!isRecord(recording) || !isRecord(event) || !isRecord(event.page)) return recording
  if (!Array.isArray(recording.pages)) recording.pages = []
  let page
  const last = recording.pages.at(-1)
  if (last?.key === event.page.key) {
    page = last
  } else {
    if (recording.pages.length >= MAX_MACRO_PAGES) return recording
    const url = new URL(boundedText(event.page.url, 3000))
    if (url.origin !== recording.origin) return recording
    page = {
      key: boundedText(event.page.key, 500),
      url: url.toString(),
      title: boundedText(event.page.title, 500),
      signature: boundedText(event.page.signature, 200),
      actions: [],
    }
    recording.pages.push(page)
  }
  const action = sanitizeAction(event.action)
  const total = recording.pages.reduce((count, candidate) => count + candidate.actions.length, 0)
  const identity = `${action.kind}|${locatorIdentity(action.locator)}`
  const existing = page.actions.findIndex(candidate => `${candidate.kind}|${locatorIdentity(candidate.locator)}` === identity)
  if (existing >= 0) page.actions[existing] = action
  else if (total < MAX_MACRO_ACTIONS) page.actions.push(action)
  recording.updatedAt = Date.now()
  return recording
}

export function finishMacro(recording) {
  return validateMacro({
    schemaVersion: MACRO_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: recording.name,
    origin: recording.origin,
    createdAt: Date.now(),
    pages: recording.pages,
  })
}

export function macroStats(macro) {
  const actions = macro.pages.reduce((total, page) => total + page.actions.filter(action => action.kind !== 'advance').length, 0)
  return { pages: macro.pages.length, actions }
}
