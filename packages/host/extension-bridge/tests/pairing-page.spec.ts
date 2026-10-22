import { brandString } from '@deepseek-ai/dsh-brand'
import { describe, expect, it } from 'vitest'
import { renderPairingPage, renderRefused, renderSignInRequired } from '../src/pairing-page.ts'
import type { ExtensionPairingToken } from '../src/types.ts'

const ORIGIN = 'chrome-extension://ndfighammhdpfaejmadojjaaelmpadek'

describe('pairing page', () => {
  it('offers approval for an unpaired origin and lists what a token grants', () => {
    const html = renderPairingPage({ origins: [{ origin: ORIGIN, pairing: undefined }], agentPresets: ['browser', '<chat>'], knowledge: true }, 'nonce-1')
    expect(html).toContain('<style nonce="nonce-1">')
    expect(html).toContain(`<code>${ORIGIN}</code>`)
    expect(html).toContain('Situação: não pareada.')
    expect(html).toContain('<form method="post" action="pair">')
    expect(html).toContain('Aprovar e gerar código')
    expect(html).not.toContain('action="revoke"')
    expect(html).toContain('<code>browser</code>, <code>&lt;chat&gt;</code>')
    expect(html).toContain('adicionar documentos à Memória Curupira')
    expect(html).not.toContain('<script')
  })

  it('shows a paired origin with regeneration and revocation, and the issued token once', () => {
    const pairedAt = Date.UTC(2026, 9, 22, 12, 0, 0)
    const token = brandString<ExtensionPairingToken>('t'.repeat(43))
    const html = renderPairingPage({
      origins: [{ origin: ORIGIN, pairing: { origin: ORIGIN, tokenSha256: '0'.repeat(64), pairedAt } }],
      agentPresets: ['browser'],
      knowledge: false,
      issued: { origin: ORIGIN, token },
    }, 'n')
    expect(html).toContain(`<time datetime="${new Date(pairedAt).toISOString()}">`)
    expect(html).toContain('Gerar novo código')
    expect(html).toContain('<form method="post" action="revoke">')
    expect(html).toContain(`<code class="token">${token}</code>`)
    expect(html).not.toContain('Memória Curupira')
  })

  it('confirms a revocation and renders the sign-in and refusal pages', () => {
    expect(renderPairingPage({ origins: [], agentPresets: ['browser'], knowledge: false, revoked: ORIGIN }, 'n'))
      .toContain(`Pareamento de <code>${ORIGIN}</code> revogado.`)
    expect(renderSignInRequired('n')).toContain('pnpm curupiracode web')
    expect(renderRefused('n')).toContain('Pedido recusado')
  })
})
