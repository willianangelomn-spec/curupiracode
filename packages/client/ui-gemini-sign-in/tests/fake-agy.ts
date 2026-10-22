/** A shell stand-in for agy's `AGY_CLI_CDE_AUTH_ACTION` check and login actions. */
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Authorization code the fake accepts. */
export const GOOD_CODE = 'good-code'
/** Authorization URL the fake prints, without its terminal colors. */
export const FAKE_URL = 'https://accounts.google.com/o/oauth2/auth?client_id=fake&state=s1'

/** One fake agy installation and the files it writes beside itself. */
export interface FakeAgy {
  /** Executable path. */
  readonly binary: string
  /** File the login action writes its working directory into. */
  readonly loginCwdFile: string
  /** Remove the installation. */
  readonly dispose: () => Promise<void>
}

/**
 * Install a fake agy. `check` exits 0 once a login stored the sign-in; `login`
 * prints a colored URL, reads one code line, and stores the sign-in for {@link GOOD_CODE}.
 * @param variant - `normal`, or `early-exit` for a login that fails before printing a URL.
 * @returns the installation.
 */
export async function installFakeAgy(variant: 'normal' | 'early-exit' = 'normal'): Promise<FakeAgy> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-fake-agy-'))
  const binary = join(directory, 'agy')
  const signIn = [
    `pwd > "${directory}/login-cwd"`,
    `printf '\\033[1mPlease visit the following URL to authorize the application:\\033[0m\\n\\n\\033[34m${FAKE_URL}\\033[0m\\n\\nEnter the authorization code:\\n'`,
    'read code',
    `if [ "$code" = "${GOOD_CODE}" ]; then : > "${directory}/signed-in"; echo "Authentication successful."; exit 0; fi`,
    'echo \'Authentication failed: oauth2: "invalid_grant" "Bad Request"\'',
    'exit 1',
  ].join('\n')
  const login = variant === 'early-exit' ? 'echo "Error: keyring unavailable" >&2; exit 3' : signIn
  await writeFile(binary, [
    '#!/bin/sh',
    'case "$AGY_CLI_CDE_AUTH_ACTION" in',
    `  check) [ -f "${directory}/signed-in" ] && exit 0; exit 1 ;;`,
    '  login)',
    login,
    '  ;;',
    'esac',
    'exit 2',
    '',
  ].join('\n'))
  await chmod(binary, 0o755)
  return {
    binary,
    loginCwdFile: join(directory, 'login-cwd'),
    dispose: () => rm(directory, { recursive: true, force: true }),
  }
}
