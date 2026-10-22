// CurupiraCode chat panel: renders the transcript the extension posts and sends the user's actions back.
(function () {
  /* global acquireVsCodeApi -- provided by the VS Code webview host */
  const vscode = acquireVsCodeApi()
  const log = document.getElementById('log')
  const input = document.getElementById('input')
  const send = document.getElementById('send')
  const stop = document.getElementById('stop')
  const model = document.getElementById('model')
  const status = document.getElementById('status')
  const editor = document.getElementById('editor')
  let busy = false

  /** Escape text for HTML. */
  function escape(text) {
    return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
  }

  /** Inline markdown on already-escaped text: code, bold, italics, and http(s) links. */
  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
  }

  /** Small markdown subset: fenced code, headings, lists, and paragraphs. Input is untrusted model text. */
  function markdown(source) {
    const out = []
    const lines = source.split('\n')
    let list = null
    let paragraph = []
    const flushParagraph = () => {
      if (paragraph.length > 0) out.push(`<p>${inline(escape(paragraph.join('\n'))).replace(/\n/g, '<br>')}</p>`)
      paragraph = []
    }
    const flushList = () => {
      if (list !== null) out.push(`<${list.tag}>${list.items.map(item => `<li>${inline(escape(item))}</li>`).join('')}</${list.tag}>`)
      list = null
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fence = /^(```|~~~)(.*)$/.exec(line)
      if (fence !== null) {
        flushParagraph()
        flushList()
        const body = []
        i++
        while (i < lines.length && !lines[i].startsWith(fence[1])) body.push(lines[i++])
        out.push(`<pre><code>${escape(body.join('\n'))}</code></pre>`)
        continue
      }
      const heading = /^(#{1,4})\s+(.*)$/.exec(line)
      const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
      const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
      if (heading !== null) {
        flushParagraph()
        flushList()
        out.push(`<h4>${inline(escape(heading[2]))}</h4>`)
      } else if (bullet !== null || numbered !== null) {
        flushParagraph()
        const tag = bullet !== null ? 'ul' : 'ol'
        if (list === null || list.tag !== tag) {
          flushList()
          list = { tag, items: [] }
        }
        list.items.push((bullet ?? numbered)[1])
      } else if (line.trim() === '') {
        flushParagraph()
        flushList()
      } else {
        flushList()
        paragraph.push(line)
      }
    }
    flushParagraph()
    flushList()
    return out.join('')
  }

  /** Append one transcript entry. */
  function append(item) {
    const node = document.createElement('div')
    node.className = `item ${item.kind}`
    if (item.kind === 'assistant') node.innerHTML = markdown(item.text)
    else if (item.kind === 'tool') node.textContent = `Ferramenta: ${item.name}`
    else node.textContent = item.text
    log.appendChild(node)
    log.scrollTop = log.scrollHeight
  }

  function submit() {
    const text = input.value
    if (busy || text.trim() === '') return
    vscode.postMessage({ type: 'send', text, includeEditor: editor.checked })
    input.value = ''
  }

  window.addEventListener('message', (event) => {
    const message = event.data
    if (message.type === 'reset') {
      log.replaceChildren()
      if (message.items.length === 0) {
        const hello = document.createElement('div')
        hello.className = 'item notice'
        hello.textContent = 'Converse com o CurupiraCode sobre o projeto aberto. Marque "Incluir arquivo ou seleção" para enviar o código do editor junto.'
        log.appendChild(hello)
      }
      for (const item of message.items) append(item)
    } else if (message.type === 'item') {
      append(message.item)
    } else if (message.type === 'state') {
      busy = message.busy
      send.disabled = busy
      stop.hidden = !busy
      status.textContent = message.status
      model.replaceChildren(...message.models.map((choice) => {
        const option = document.createElement('option')
        option.value = choice.id
        option.textContent = choice.label
        option.selected = choice.id === message.model
        return option
      }))
    }
  })

  // Links open in the external browser through the extension host, never inside the webview.
  log.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (anchor === null) return
    event.preventDefault()
    vscode.postMessage({ type: 'openLink', url: anchor.getAttribute('href') })
  })

  send.addEventListener('click', submit)
  stop.addEventListener('click', () => { vscode.postMessage({ type: 'stop' }) })
  document.getElementById('new').addEventListener('click', () => { vscode.postMessage({ type: 'newConversation' }) })
  document.getElementById('full').addEventListener('click', () => { vscode.postMessage({ type: 'openFull' }) })
  model.addEventListener('change', () => { vscode.postMessage({ type: 'selectModel', id: model.value }) })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault()
      submit()
    }
  })
  vscode.postMessage({ type: 'ready' })
})()
