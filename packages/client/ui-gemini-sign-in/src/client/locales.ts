/** Locale-owned copy of the Gemini sign-in card. */

/** Dictionary namespace for this plugin. */
export const NS = 'geminiSignIn'

/** English copy and key source. */
export const en = {
  checking: 'Checking the Google sign-in…',
  signedIn: 'Signed in to Google through the Antigravity CLI.',
  signedOut: 'Sign in with your Google account to use the Gemini models, including Gemini 4 Argon. No API key is needed.',
  signIn: 'Sign in with Google',
  starting: 'Opening the sign-in…',
  stepOpen: '1. Open the Google page and allow access.',
  openPage: 'Open the Google sign-in page',
  stepPaste: '2. Copy the code Google shows at the end and paste it here.',
  codeLabel: 'Authorization code',
  codePlaceholder: 'Paste the code',
  confirm: 'Confirm',
  confirming: 'Confirming…',
  cancel: 'Cancel',
  recheck: 'Check again',
  refused: 'The sign-in did not complete: {reason}',
  cliMissing: 'The Antigravity CLI (agy) is not installed on the computer running CurupiraCode. Install it with the command below, then check again.',
  unavailable: 'The sign-in state could not be read: {reason}',
}

/** Locale dictionary key union. */
export type GeminiSignInKey = keyof typeof en

/** Chinese copy. */
export const zh: Record<GeminiSignInKey, string> = {
  checking: '正在检查 Google 登录状态…',
  signedIn: '已通过 Antigravity CLI 登录 Google。',
  signedOut: '使用 Google 账号登录即可使用 Gemini 模型（包括 Gemini 4 Argon），无需 API key。',
  signIn: '使用 Google 登录',
  starting: '正在打开登录…',
  stepOpen: '1. 打开 Google 页面并允许访问。',
  openPage: '打开 Google 登录页面',
  stepPaste: '2. 复制 Google 最后显示的代码并粘贴到这里。',
  codeLabel: '授权代码',
  codePlaceholder: '粘贴代码',
  confirm: '确认',
  confirming: '正在确认…',
  cancel: '取消',
  recheck: '重新检查',
  refused: '登录未完成：{reason}',
  cliMissing: '运行 CurupiraCode 的电脑上没有安装 Antigravity CLI（agy）。请用下面的命令安装，然后重新检查。',
  unavailable: '无法读取登录状态：{reason}',
}
