// Stand-in for `dsh --profile sdk`: answers the SDK JSON-RPC methods the extension uses on stdio.
// FAKE_RUNTIME=crash exits during startup with a stderr line; FAKE_RUNTIME=silent never answers initialize.
import { createInterface } from 'node:readline'

const mode = process.env.FAKE_RUNTIME ?? 'normal'
if (mode === 'crash') {
  process.stderr.write('Error: plugin llm-gemini failed\n')
  process.exit(3)
}
const send = frame => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...frame })}\n`)
let route
createInterface({ input: process.stdin }).on('line', (line) => {
  const frame = JSON.parse(line)
  if (frame.method === 'initialize') {
    if (mode === 'silent') return
    route = frame.params
    send({ id: frame.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: 'test' } } })
  } else if (frame.method === 'session/prompt') {
    const { sessionId, contentBlocks } = frame.params
    send({ id: frame.id, result: { messageId: 'm1' } })
    send({ method: 'session.status', params: { sessionId, status: 'running' } })
    send({ method: 'session.event', params: { sessionId, event: { type: 'tool/call', data: { name: 'read' } } } })
    const text = `${route.provider}/${route.model} em ${route.cwd}: ${contentBlocks[0].text}`
    send({ method: 'session.event', params: { sessionId, event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } } } })
    send({ method: 'session.status', params: { sessionId, status: 'idle' } })
  } else if (frame.method === 'session/resume') {
    if (frame.params.sessionId === 'known') send({ id: frame.id, result: {} })
    else send({ id: frame.id, error: { code: -32000, message: 'unknown session' } })
  } else if (frame.method === 'shutdown') {
    send({ id: frame.id, result: {} })
    process.exit(0)
  }
})
