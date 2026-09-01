import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
await cp(join(root, 'manifest.json'), join(dist, 'manifest.json'))
await cp(join(root, 'src'), join(dist, 'src'), { recursive: true })
await cp(join(root, 'icons'), join(dist, 'icons'), { recursive: true })
console.log(`CurupiraCode browser extension built at ${dist}`)
