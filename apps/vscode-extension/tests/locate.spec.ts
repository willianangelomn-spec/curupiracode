/** Which checkout, Node.js, and environment the runtime starts with. */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findInstallation, findNode, RUNTIME_ENTRY, runtimeEnvironment } from '../src/locate.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function checkout(built: boolean): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'curupira-checkout-'))
  roots.push(root)
  if (built) {
    await mkdir(join(root, 'apps', 'cli', 'lib'), { recursive: true })
    await writeFile(join(root, RUNTIME_ENTRY), '')
  }
  return root
}

describe('findInstallation', () => {
  it('uses a configured checkout and never replaces an invalid one', async () => {
    const built = await checkout(true)
    const empty = await checkout(false)
    expect(findInstallation(built, [], empty)).toEqual({ ok: true, root: built, entry: join(built, RUNTIME_ENTRY) })
    expect(findInstallation(empty, [built], built)).toEqual({ ok: false, reason: 'configured-invalid', configured: empty })
  })

  it('falls back to an open checkout folder, then ~/curupiracode', async () => {
    const workspace = await checkout(true)
    const home = await checkout(false)
    expect(findInstallation('', [workspace], home)).toMatchObject({ ok: true, root: workspace })
    await mkdir(join(home, 'curupiracode', 'apps', 'cli', 'lib'), { recursive: true })
    await writeFile(join(home, 'curupiracode', RUNTIME_ENTRY), '')
    expect(findInstallation('', [], home)).toMatchObject({ ok: true, root: join(home, 'curupiracode') })
    expect(findInstallation('', [], await checkout(false))).toEqual({ ok: false, reason: 'not-found' })
  })
})

describe('runtime environment', () => {
  it('puts Node and the agy installer directory first and drops the extension host Electron switch', () => {
    const env = runtimeEnvironment('/opt/node/bin/node', { PATH: ['/usr/bin', '/opt/node/bin'].join(delimiter), ELECTRON_RUN_AS_NODE: '1' }, '/home/u')
    expect(env.PATH).toBe(['/opt/node/bin', join('/home/u', '.local', 'bin'), '/usr/bin'].join(delimiter))
    expect(env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('prefers the configured Node.js', async () => {
    expect(await findNode('/custom/node', 'darwin', {})).toBe('/custom/node')
    expect(await findNode('', 'win32', {})).toBe('node')
  })
})
