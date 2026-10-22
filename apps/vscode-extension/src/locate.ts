/**
 * Find what the extension starts the CurupiraCode runtime with: a built
 * CurupiraCode checkout and the system Node.js. The extension host runs on
 * VS Code's own Electron build of Node, whose native-module ABI differs from
 * the one the checkout was installed for, so the runtime always runs on the
 * system `node`.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { delimiter, dirname, isAbsolute, join } from 'node:path'

/** Built `curupiracode`/`dsh` entry inside a checkout. */
export const RUNTIME_ENTRY = join('apps', 'cli', 'lib', 'bin.js')

/** Where Node.js installers commonly put `node` when a GUI app does not inherit the shell PATH. */
const NODE_CANDIDATES = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node']

/** Bound on the login-shell lookup of `node`. */
const SHELL_LOOKUP_TIMEOUT_MS = 8000

/** A located checkout, or why none could be used. */
export type Installation =
  | { readonly ok: true; readonly root: string; readonly entry: string }
  | { readonly ok: false; readonly reason: 'configured-invalid'; readonly configured: string }
  | { readonly ok: false; readonly reason: 'not-found' }

/**
 * Locate the built entry of one checkout.
 * @param root - checkout directory.
 * @returns the entry path, or undefined when the checkout is missing or not built.
 */
export function runtimeEntry(root: string): string | undefined {
  const entry = join(root, RUNTIME_ENTRY)
  return existsSync(entry) ? entry : undefined
}

/**
 * Pick the checkout: the configured one when set, otherwise the first open
 * workspace folder that is a built checkout, otherwise `~/curupiracode`.
 * @param configured - the `curupiracode.installPath` setting; empty when unset.
 * @param workspaceFolders - open workspace folder paths.
 * @param home - the user's home directory.
 * @returns the checkout, or why none is usable. A configured path is never silently replaced.
 */
export function findInstallation(configured: string, workspaceFolders: readonly string[], home: string = os.homedir()): Installation {
  if (configured !== '') {
    const entry = runtimeEntry(configured)
    return entry === undefined ? { ok: false, reason: 'configured-invalid', configured } : { ok: true, root: configured, entry }
  }
  for (const root of [...workspaceFolders, join(home, 'curupiracode')]) {
    const entry = runtimeEntry(root)
    if (entry !== undefined) return { ok: true, root, entry }
  }
  return { ok: false, reason: 'not-found' }
}

/**
 * Ask the user's login shell where `node` is, so version managers such as nvm apply.
 * @param shell - login shell executable.
 * @param env - environment the shell starts with.
 * @returns the absolute path, or undefined when the shell names none.
 */
function nodeFromLoginShell(shell: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(shell, ['-ilc', 'command -v node'], { timeout: SHELL_LOOKUP_TIMEOUT_MS, env }, (error, stdout) => {
      if (error !== null) {
        resolve(undefined)
        return
      }
      resolve(stdout.split('\n').map(line => line.trim()).reverse().find(line => isAbsolute(line)))
    })
  })
}

/**
 * Pick the system Node.js: the configured one, then the login shell's `node`,
 * then the common install locations, then `node` on PATH.
 * @param configured - the `curupiracode.nodePath` setting; empty when unset.
 * @param platform - host platform.
 * @param env - extension host environment.
 * @returns the executable to spawn.
 */
export async function findNode(
  configured: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (configured !== '') return configured
  if (platform !== 'win32') {
    const fromShell = await nodeFromLoginShell(env.SHELL ?? '/bin/zsh', env)
    if (fromShell !== undefined) return fromShell
    const installed = NODE_CANDIDATES.find(candidate => existsSync(candidate))
    if (installed !== undefined) return installed
  }
  return 'node'
}

/**
 * Environment for the runtime: the extension host's, with Node's directory and
 * the Antigravity installer's `~/.local/bin` ahead on PATH so the runtime finds
 * both even when VS Code started without the shell PATH.
 * @param node - the Node.js executable the runtime runs on.
 * @param env - extension host environment.
 * @param home - the user's home directory.
 * @returns the child environment.
 */
export function runtimeEnvironment(node: string, env: NodeJS.ProcessEnv = process.env, home: string = os.homedir()): NodeJS.ProcessEnv {
  const extra = [isAbsolute(node) ? dirname(node) : undefined, join(home, '.local', 'bin')].filter((entry): entry is string => entry !== undefined)
  const path = [...extra, ...(env.PATH ?? '').split(delimiter).filter(entry => entry !== '' && !extra.includes(entry))].join(delimiter)
  const childEnv: NodeJS.ProcessEnv = { ...env, PATH: path }
  // The extension host sets it for itself; it would turn a nested Electron into plain Node.
  delete childEnv.ELECTRON_RUN_AS_NODE
  return childEnv
}
