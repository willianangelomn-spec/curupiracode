(() => {
  if (globalThis.__CURUPIRA_CONTENT_SCRIPT__) return
  globalThis.__CURUPIRA_CONTENT_SCRIPT__ = true

  const ID_ATTRIBUTE = 'data-curupira-extension-id'
  const MAX_ELEMENTS = 250
  const MAX_TEXT = 40000
  const HIGH_RISK = /\b(apagar|deletar|excluir|remover|comprar|pagar|transferir|publicar|enviar|confirmar pedido|finalizar compra|assinar|delete|remove|buy|pay|transfer|publish|send|submit|checkout)\b/i
  const ADVANCE = /\b(pr[oó]ximo|pr[oó]xima|continuar|avan[cç]ar|seguinte|next|continue)\b/i
  const FINAL_SUBMIT = /\b(enviar|finalizar|concluir|confirmar|inscrever|cadastrar|submit|finish|complete|confirm|register|apply)\b/i
  let macroRecording = false
  let macroListenersInstalled = false
  const macroInputTimers = new WeakMap()

  function visible(element) {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1
  }

  function compact(value, max = 180) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  }

  function labelFor(element) {
    const labelledBy = element.getAttribute('aria-labelledby')
    const labelled = labelledBy?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ')
    const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : ''
    const enclosing = element.closest('label')?.textContent
    const buttonValue = element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type) ? element.value : ''
    return compact(element.getAttribute('aria-label') || labelled || explicit || enclosing || element.textContent || buttonValue
      || element.getAttribute('placeholder') || element.getAttribute('title') || element.getAttribute('name') || element.id || element.tagName)
  }

  function roleFor(element) {
    return element.getAttribute('role') || element.tagName.toLowerCase()
  }

  function describedBy(element) {
    const ids = element.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? []
    return compact(ids.map(id => document.getElementById(id)?.textContent ?? '').join(' '), 400)
  }

  function questionFor(element, fallback) {
    const fieldset = element.closest('fieldset')
    const legend = fieldset?.querySelector(':scope > legend')?.textContent
    if (compact(legend)) return compact(legend, 400)
    const group = element.closest('[role="radiogroup"],[role="group"],[data-question],.question,.form-group,.form-field,.field-group')
    if (group) {
      const labelledBy = group.getAttribute('aria-labelledby')
      const groupLabel = group.getAttribute('aria-label')
        || (labelledBy ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ') : '')
        || group.querySelector(':scope > legend,:scope > label,:scope > .label,:scope > .question-label')?.textContent
      if (compact(groupLabel)) return compact(groupLabel, 400)
    }
    return fallback
  }

  function sensitive(element, label) {
    const autocomplete = element.getAttribute('autocomplete') || ''
    const type = element.getAttribute('type') || ''
    const identity = `${label} ${element.getAttribute('name') ?? ''} ${element.id} ${element.getAttribute('placeholder') ?? ''}`
    return type === 'password'
      || /one-time-code|cc-|password/i.test(autocomplete)
      || /senha|password|cart[aã]o|credit.?card|card.?number|cvv|cvc|otp|one.?time|verification.?code|c[oó]digo de autentica[cç][aã]o/i.test(identity)
  }

  function hashText(value) {
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    return (hash >>> 0).toString(36)
  }

  function pageInfo() {
    const fields = [...document.querySelectorAll('input:not([type="hidden"]),select,textarea,[contenteditable="true"]')]
      .filter(visible).slice(0, 120)
    const signature = hashText(fields.map(element => `${element.tagName}:${element.getAttribute('type') ?? ''}:${questionFor(element, labelFor(element))}`).join('|'))
    const documentToken = Math.round(performance.timeOrigin).toString(36)
    return {
      key: `${location.origin}${location.pathname}|${signature}|${documentToken}`,
      url: location.href,
      title: document.title,
      signature,
    }
  }

  function locatorFor(element) {
    const label = labelFor(element)
    const question = questionFor(element, label)
    const tag = element.tagName.toLowerCase()
    const type = compact(element.getAttribute('type') || '').toLowerCase()
    const similar = [...document.querySelectorAll(tag)].filter(candidate => {
      return compact(candidate.getAttribute('type') || '').toLowerCase() === type
        && labelFor(candidate) === label
        && questionFor(candidate, labelFor(candidate)) === question
    })
    return {
      tag,
      type,
      id: compact(element.id, 200),
      name: compact(element.getAttribute('name'), 200),
      ariaLabel: compact(element.getAttribute('aria-label'), 300),
      placeholder: compact(element.getAttribute('placeholder'), 300),
      label,
      question,
      text: compact(element instanceof HTMLInputElement ? element.value : element.textContent, 300),
      ordinal: Math.max(0, similar.indexOf(element)),
    }
  }

  function sendMacroAction(action) {
    if (!macroRecording) return Promise.resolve()
    return chrome.runtime.sendMessage({
      source: 'curupira-content',
      type: 'macro-event',
      event: { page: pageInfo(), action },
    }).catch(() => undefined)
  }

  function recordMacroField(element, includeEmpty) {
    if (!(element instanceof HTMLElement) || !visible(element)) return
    const label = labelFor(element)
    if (sensitive(element, label)) return
    const locator = locatorFor(element)
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
      if (element.type === 'radio' && !element.checked) return
      if (!includeEmpty && !element.checked) return
      return sendMacroAction({ kind: 'check', locator, value: element.checked })
    }
    if (element instanceof HTMLSelectElement) {
      if (!includeEmpty && element.value === '') return
      return sendMacroAction({
        kind: 'select', locator, value: element.value,
        optionLabel: compact(element.selectedOptions[0]?.textContent, 500),
      })
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element.isContentEditable) {
      if (element instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image'].includes(element.type)) return
      const value = element.isContentEditable ? element.textContent ?? '' : element.value
      if (!includeEmpty && value === '') return
      return sendMacroAction({ kind: 'fill', locator, value: String(value).slice(0, 10000) })
    }
  }

  function installMacroListeners() {
    if (macroListenersInstalled) return
    macroListenersInstalled = true
    document.addEventListener('input', event => {
      if (!macroRecording || !(event.target instanceof HTMLElement)) return
      const previous = macroInputTimers.get(event.target)
      if (previous) clearTimeout(previous)
      const timer = setTimeout(() => recordMacroField(event.target, true), 350)
      macroInputTimers.set(event.target, timer)
    }, true)
    document.addEventListener('change', event => {
      if (macroRecording && event.target instanceof HTMLElement) recordMacroField(event.target, true)
    }, true)
    document.addEventListener('click', event => {
      if (!macroRecording || !(event.target instanceof Element)) return
      const control = event.target.closest('button,input[type="button"],input[type="submit"],[role="button"],a[href]')
      if (!(control instanceof HTMLElement)) return
      const label = labelFor(control)
      if (!ADVANCE.test(label) || FINAL_SUBMIT.test(label) || sensitive(control, label)) return
      sendMacroAction({ kind: 'advance', locator: locatorFor(control) })
    }, true)
  }

  function startMacroRecording() {
    macroRecording = true
    installMacroListeners()
    for (const element of document.querySelectorAll('input:not([type="hidden"]),select,textarea,[contenteditable="true"]')) {
      recordMacroField(element, false)
    }
  }

  async function flushMacroRecording() {
    const pending = []
    for (const element of document.querySelectorAll('input:not([type="hidden"]),select,textarea,[contenteditable="true"]')) {
      pending.push(recordMacroField(element, true))
    }
    await Promise.all(pending)
  }

  function candidateControls(kind) {
    const selector = kind === 'advance'
      ? 'button,input[type="button"],input[type="submit"],[role="button"],a[href]'
      : 'input:not([type="hidden"]),select,textarea,[contenteditable="true"]'
    return [...document.querySelectorAll(selector)].filter(visible)
  }

  function normalized(value) {
    return compact(value, 700).toLocaleLowerCase('pt-BR')
  }

  function locatorScore(element, locator) {
    if (element.tagName.toLowerCase() !== locator.tag) return -1
    const actual = locatorFor(element)
    let score = 5
    if (locator.type && actual.type === locator.type) score += 10
    if (locator.id && actual.id === locator.id) score += 70
    if (locator.name && actual.name === locator.name) score += 45
    if (locator.ariaLabel && normalized(actual.ariaLabel) === normalized(locator.ariaLabel)) score += 40
    if (locator.label && normalized(actual.label) === normalized(locator.label)) score += 45
    if (locator.question && normalized(actual.question) === normalized(locator.question)) score += 35
    if (locator.placeholder && normalized(actual.placeholder) === normalized(locator.placeholder)) score += 25
    if (locator.text && normalized(actual.text) === normalized(locator.text)) score += 20
    if (actual.ordinal === locator.ordinal) score += 5
    return score
  }

  function resolveMacroElement(action) {
    const ranked = candidateControls(action.kind)
      .map(element => ({ element, score: locatorScore(element, action.locator) }))
      .filter(candidate => candidate.score >= 30)
      .sort((left, right) => right.score - left.score)
    if (ranked.length === 0) throw new Error(`campo “${action.locator.label || action.locator.question || action.locator.name}” não encontrado`)
    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
      const selected = ranked.filter(candidate => candidate.score === ranked[0].score)[action.locator.ordinal]
      if (selected) return selected.element
    }
    return ranked[0].element
  }

  function matchMacroStep(actions) {
    const candidates = actions.slice(0, 100)
    let matched = 0
    for (const action of candidates) {
      try {
        resolveMacroElement(action)
        matched += 1
      } catch {
        // Matching is read-only; replay reports the detailed missing field.
      }
    }
    return { matched, total: candidates.length, page: pageInfo() }
  }

  async function replayMacroStep(actions) {
    const results = []
    let advance
    for (const action of actions.slice(0, 100)) {
      try {
        const element = resolveMacroElement(action)
        const label = labelFor(element)
        if (sensitive(element, label)) throw new Error('campo sensível bloqueado')
        if (action.kind === 'advance') {
          if (!ADVANCE.test(label) || FINAL_SUBMIT.test(label)) throw new Error('avanço final ou desconhecido bloqueado')
          advance = element
          results.push({ ok: true, kind: action.kind, label })
          continue
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (action.kind === 'fill') {
          setNativeValue(element, action.value)
        } else if (action.kind === 'select') {
          if (!(element instanceof HTMLSelectElement)) throw new Error('campo não é uma lista')
          let option = [...element.options].find(candidate => candidate.value === action.value)
          if (!option && action.optionLabel) option = [...element.options].find(candidate => normalized(candidate.textContent) === normalized(action.optionLabel))
          if (!option) throw new Error('opção gravada não existe')
          element.value = option.value
          element.dispatchEvent(new Event('input', { bubbles: true }))
          element.dispatchEvent(new Event('change', { bubbles: true }))
        } else if (action.kind === 'check') {
          if (!(element instanceof HTMLInputElement) || !['checkbox', 'radio'].includes(element.type)) throw new Error('campo não é marcável')
          if (element.type === 'radio' && action.value !== true) throw new Error('opção de rádio inválida')
          if (element.checked !== action.value) element.click()
        }
        results.push({ ok: true, kind: action.kind, label })
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        results.push({ ok: false, kind: action.kind, error: error instanceof Error ? error.message : String(error) })
      }
    }
    const shouldAdvance = Boolean(advance) && results.every(result => result.ok)
    if (shouldAdvance) setTimeout(() => advance.click(), 300)
    return { results, advanced: shouldAdvance, page: pageInfo() }
  }

  function capture() {
    document.querySelectorAll(`[${ID_ATTRIBUTE}]`).forEach(element => element.removeAttribute(ID_ATTRIBUTE))
    const selector = 'a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[role="checkbox"],[contenteditable="true"]'
    const candidates = [...document.querySelectorAll(selector)].filter(visible).slice(0, MAX_ELEMENTS)
    const elements = candidates.map((element, index) => {
      const id = `curupira-${index + 1}`
      const label = labelFor(element)
      const question = questionFor(element, label)
      const description = describedBy(element)
      const type = compact(element.getAttribute('type') || '')
      element.setAttribute(ID_ATTRIBUTE, id)
      const options = element instanceof HTMLSelectElement
        ? [...element.options].slice(0, 30).map(option => ({ value: option.value.slice(0, 200), label: compact(option.textContent) }))
        : undefined
      return {
        id,
        tag: element.tagName.toLowerCase(),
        role: roleFor(element),
        type,
        label,
        question,
        ...(description ? { description } : {}),
        ...(element.matches('input,select,textarea') ? { required: element.required === true } : {}),
        ...(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
          ? (element.maxLength > 0 ? { maxLength: element.maxLength } : {})
          : {}),
        ...(element.isContentEditable ? { contentEditable: true } : {}),
        sensitive: sensitive(element, label),
        ...(element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? { checked: element.checked } : {}),
        ...(options === undefined ? {} : { options }),
      }
    })
    return {
      title: document.title,
      url: location.href,
      selection: compact(getSelection()?.toString() ?? '', 8000),
      text: (document.body?.innerText ?? '').replace(/\s+\n/g, '\n').trim().slice(0, MAX_TEXT),
      elements,
      capturedAt: Date.now(),
    }
  }

  function setNativeValue(element, value) {
    if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(element, value)
    } else if (element instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(element, value)
    } else if (element.isContentEditable) {
      element.textContent = value
    } else {
      throw new Error('o elemento não aceita texto')
    }
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async function execute(actions, allowHighRisk) {
    const results = []
    for (const action of actions) {
      try {
        if (action.type === 'scroll') {
          const distance = innerHeight * (action.amount === 'page' ? 0.9 : 0.45) * (action.direction === 'down' ? 1 : -1)
          scrollBy({ top: distance, behavior: 'smooth' })
          results.push({ ok: true, action })
          continue
        }
        const element = document.querySelector(`[${ID_ATTRIBUTE}="${CSS.escape(action.elementId)}"]`)
        if (!(element instanceof HTMLElement)) throw new Error('elemento não encontrado; recapture a página')
        const label = labelFor(element)
        if (sensitive(element, label)) throw new Error('campo sensível bloqueado')
        if ((HIGH_RISK.test(`${label} ${element.getAttribute('type') ?? ''}`) || element.getAttribute('type') === 'submit') && !allowHighRisk) {
          throw new Error('ação de risco exige confirmação')
        }
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (action.type === 'click') {
          if (element instanceof HTMLInputElement && element.type === 'file') throw new Error('upload de arquivo bloqueado')
          element.click()
        } else if (action.type === 'fill') {
          setNativeValue(element, action.value)
        } else if (action.type === 'select') {
          if (!(element instanceof HTMLSelectElement)) throw new Error('o elemento não é uma lista')
          if (![...element.options].some(option => option.value === action.value)) throw new Error('a opção planejada não existe')
          element.value = action.value
          element.dispatchEvent(new Event('input', { bubbles: true }))
          element.dispatchEvent(new Event('change', { bubbles: true }))
        } else if (action.type === 'check') {
          if (!(element instanceof HTMLInputElement) || !['checkbox', 'radio'].includes(element.type)) throw new Error('o elemento não é marcável')
          if (element.checked !== action.value) element.click()
        }
        results.push({ ok: true, action })
        await new Promise(resolve => setTimeout(resolve, 180))
      } catch (error) {
        results.push({ ok: false, action, error: error instanceof Error ? error.message : String(error) })
        break
      }
    }
    return results
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.source !== 'curupira-sidepanel') return false
    if (message.type === 'macro-record-start') {
      startMacroRecording()
      sendResponse({ ok: true, page: pageInfo() })
      return false
    }
    if (message.type === 'macro-record-stop') {
      macroRecording = false
      sendResponse({ ok: true })
      return false
    }
    if (message.type === 'macro-record-flush') {
      void flushMacroRecording()
        .then(() => sendResponse({ ok: true }))
        .catch(error => sendResponse({ ok: false, error: String(error) }))
      return true
    }
    if (message.type === 'macro-page-info') {
      sendResponse({ ok: true, page: pageInfo() })
      return false
    }
    if (message.type === 'macro-match-step') {
      sendResponse({ ok: true, ...matchMacroStep(Array.isArray(message.actions) ? message.actions : []) })
      return false
    }
    if (message.type === 'macro-replay-step') {
      void replayMacroStep(Array.isArray(message.actions) ? message.actions : [])
        .then(value => sendResponse({ ok: true, ...value }))
        .catch(error => sendResponse({ ok: false, error: String(error) }))
      return true
    }
    if (message.type === 'capture') {
      try { sendResponse({ ok: true, snapshot: capture() }) } catch (error) { sendResponse({ ok: false, error: String(error) }) }
      return false
    }
    if (message.type === 'execute') {
      if (message.expectedUrl !== location.href) {
        sendResponse({ ok: false, error: 'a página mudou desde a captura; prepare um novo plano' })
        return false
      }
      void execute(message.actions, message.allowHighRisk === true)
        .then(results => sendResponse({ ok: true, results }))
        .catch(error => sendResponse({ ok: false, error: String(error) }))
      return true
    }
    return false
  })
})()
