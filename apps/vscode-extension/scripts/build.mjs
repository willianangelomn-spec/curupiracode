// Bundle the extension into dist/ with its VS Code manifest; `--package` also writes the .vsix next to package.json.
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
// VS Code loads extensions as CommonJS and provides the `vscode` module itself.
await build({
  entryPoints: [join(root, 'src', 'extension.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  outfile: join(dist, 'extension.js'),
  legalComments: 'none',
  logLevel: 'warning',
})
await cp(join(root, 'media'), join(dist, 'media'), { recursive: true })
for (const file of ['package.nls.json', 'package.nls.pt-br.json']) await cp(join(root, file), join(dist, file))
await cp(join(root, 'MARKETPLACE.md'), join(dist, 'README.md'))
await cp(join(root, '..', '..', 'LICENSE'), join(dist, 'LICENSE.txt'))
// The workspace package.json carries the repository version; the extension versions independently.
const manifest = JSON.parse(await readFile(join(root, 'extension.manifest.json'), 'utf8'))
const { version } = manifest
await writeFile(join(dist, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`CurupiraCode VS Code extension built at ${dist}`)

if (process.argv.includes('--package')) {
  const vsce = createRequire(import.meta.url).resolve('@vscode/vsce/vsce')
  const out = join(root, `curupiracode-${version}.vsix`)
  execFileSync(process.execPath, [vsce, 'package', '--no-dependencies', '--out', out], { cwd: dist, stdio: 'inherit' })
  console.log(`CurupiraCode VS Code extension packaged at ${out}`)
}
