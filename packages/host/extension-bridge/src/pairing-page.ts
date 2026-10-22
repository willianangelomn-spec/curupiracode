/**
 * Server-rendered pairing page. The page carries no script: approval and
 * revocation are same-origin form posts, so Connection's Host/Origin fence and
 * the SameSite=Strict browser cookie decide who can submit them. Copy is
 * Brazilian Portuguese, the language of the extension that opens the page.
 */

import type { Pairing } from './pairings.ts'
import type { ExtensionPairingToken } from './types.ts'

/** Facts one page render shows. */
export interface PairingPageModel {
  /** Allowed extension origins with their current pairing. */
  readonly origins: readonly { readonly origin: string; readonly pairing: Pairing | undefined }[]
  /** Agent presets a paired extension can drive. */
  readonly agentPresets: readonly string[]
  /** Whether a paired extension can add documents to the knowledge vault. */
  readonly knowledge: boolean
  /** Token issued by the request being answered, shown once. */
  readonly issued?: { readonly origin: string; readonly token: ExtensionPairingToken }
  /** Origin whose pairing the request being answered revoked. */
  readonly revoked?: string
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('\'', '&#39;')
}

function layout(nonce: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Parear extensão — CurupiraCode</title>
<style nonce="${nonce}">
body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#16261c;background:#f6f8f5;line-height:1.5}
h1{font-size:1.5rem}section{background:#fff;border:1px solid #c9d6cc;border-radius:.5rem;padding:1rem;margin:1rem 0}
code{overflow-wrap:anywhere}.token{display:block;user-select:all;font-size:1.1rem;padding:.75rem;background:#eef4ef;border-radius:.375rem}
button{font:inherit;padding:.4rem .9rem;border-radius:.375rem;border:1px solid #2f6b45;background:#2f6b45;color:#fff;cursor:pointer}
button.secondary{background:#fff;color:#8a1f1f;border-color:#8a1f1f}form{display:inline-block;margin:.25rem .5rem .25rem 0}
.notice{border-color:#2f6b45}
</style>
</head>
<body>
${body}
</body>
</html>
`
}

function capabilityList(model: PairingPageModel): string {
  const presets = model.agentPresets.map(preset => `<code>${escapeHtml(preset)}</code>`).join(', ')
  return `<ul>
<li>criar conversas com as predefinições sem ferramentas ${presets};</li>
<li>enviar mensagens a essas conversas, ler as respostas e cancelá-las;</li>
${model.knowledge ? '<li>adicionar documentos à Memória Curupira;</li>\n' : ''}</ul>
<p>O código não dá acesso a terminal, arquivos, configurações nem a conversas com outras predefinições.</p>`
}

function originSection(origin: string, pairing: Pairing | undefined): string {
  const escaped = escapeHtml(origin)
  const status = pairing === undefined
    ? '<p>Situação: não pareada.</p>'
    : `<p>Situação: pareada em <time datetime="${new Date(pairing.pairedAt).toISOString()}">${escapeHtml(new Date(pairing.pairedAt).toLocaleString('pt-BR'))}</time>. Gerar um novo código revoga o anterior.</p>`
  const revoke = pairing === undefined
    ? ''
    : `<form method="post" action="revoke"><input type="hidden" name="origin" value="${escaped}"><button class="secondary" type="submit">Revogar</button></form>`
  return `<section>
<h2>Extensão <code>${escaped}</code></h2>
${status}
<form method="post" action="pair"><input type="hidden" name="origin" value="${escaped}"><button type="submit">${pairing === undefined ? 'Aprovar e gerar código' : 'Gerar novo código'}</button></form>${revoke}
</section>`
}

/**
 * Render the pairing page.
 * @param model - pairings and capabilities to show.
 * @param nonce - per-response CSP nonce for the inline style.
 * @returns the complete HTML document.
 */
export function renderPairingPage(model: PairingPageModel, nonce: string): string {
  const issued = model.issued === undefined
    ? ''
    : `<section class="notice">
<h2>Código de pareamento</h2>
<code class="token">${escapeHtml(model.issued.token)}</code>
<p>Copie este código, cole no campo «Código de pareamento» do painel da extensão e clique em Salvar. Ele não será mostrado de novo.</p>
</section>`
  const revoked = model.revoked === undefined
    ? ''
    : `<section class="notice"><p>Pareamento de <code>${escapeHtml(model.revoked)}</code> revogado. A extensão precisa de um novo código.</p></section>`
  return layout(nonce, `<h1>Parear a extensão CurupiraCode</h1>
<p>A extensão para Chrome e Edge só conversa com este CurupiraCode depois que você aprova o pareamento aqui. Um código aprovado permite à extensão:</p>
${capabilityList(model)}
${issued}${revoked}
${model.origins.map(({ origin, pairing }) => originSection(origin, pairing)).join('\n')}`)
}

/**
 * Render the page answering a request without a browser session.
 * @param nonce - per-response CSP nonce for the inline style.
 * @returns the complete HTML document.
 */
export function renderSignInRequired(nonce: string): string {
  return layout(nonce, `<h1>Entre no CurupiraCode primeiro</h1>
<p>Abra neste navegador o endereço com <code>?token=</code> impresso por <code>pnpm curupiracode web</code> e depois clique de novo em «Parear» na extensão.</p>`)
}

/**
 * Render the page answering a request Connection's Host/Origin fence refused.
 * @param nonce - per-response CSP nonce for the inline style.
 * @returns the complete HTML document.
 */
export function renderRefused(nonce: string): string {
  return layout(nonce, `<h1>Pedido recusado</h1>
<p>A página de pareamento só aceita pedidos feitos por ela mesma, no endereço local do CurupiraCode.</p>`)
}
