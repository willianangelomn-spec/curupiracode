import { createHash, createPublicKey } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3')
const der = createPublicKey({ key: Buffer.from(manifest.key, 'base64'), type: 'spki', format: 'der' }).export({ type: 'spki', format: 'der' })
const id = [...createHash('sha256').update(der).digest().subarray(0, 16)]
  .map(byte => `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 15))}`).join('')
if (id !== 'ndfighammhdpfaejmadojjaaelmpadek') throw new Error(`unexpected extension id ${id}`)
for (const permission of manifest.host_permissions) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)\/\*$/.test(permission)) throw new Error(`non-loopback host permission ${permission}`)
}
for (const path of [manifest.background.service_worker, manifest.side_panel.default_path, ...Object.values(manifest.icons)]) {
  await access(join(root, path))
}
console.log(`Manifest V3 verified; stable extension id: ${id}`)
