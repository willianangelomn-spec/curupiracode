/**
 * VS Code entry: the CurupiraCode chat view in the activity bar, its commands,
 * and the bridge between the webview and {@link ChatController}.
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { relative } from 'node:path'
import * as vscode from 'vscode'
import { ChatController, type ControllerHost, type FromPanel, type ToPanel } from './controller.ts'
import type { EditorContext } from './conversation.ts'

/** Webview view id declared in the extension manifest. */
const VIEW_ID = 'curupiracode.chat'
/** workspaceState key of the conversation id. */
const SESSION_KEY = 'curupiracode.sessionId'

/** Read the active editor's selection, or its whole file when nothing is selected. */
function activeEditorContext(): EditorContext | undefined {
  const editor = vscode.window.activeTextEditor
  if (editor === undefined) return undefined
  const document = editor.document
  const folder = vscode.workspace.getWorkspaceFolder(document.uri)
  const path = folder === undefined ? document.fileName : relative(folder.uri.fsPath, document.uri.fsPath)
  const selection = editor.selection
  if (selection.isEmpty) {
    return { path, languageId: document.languageId, text: document.getText(), startLine: 1, endLine: document.lineCount, selection: false }
  }
  return {
    path,
    languageId: document.languageId,
    text: document.getText(selection),
    startLine: selection.start.line + 1,
    endLine: selection.end.line + 1,
    selection: true,
  }
}

/** The chat webview: static HTML over bundled script and style, talking through postMessage. */
class ChatViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined

  constructor(private readonly extensionUri: vscode.Uri, private readonly onMessage: (message: FromPanel) => void) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view
    const media = vscode.Uri.joinPath(this.extensionUri, 'media')
    view.webview.options = { enableScripts: true, localResourceRoots: [media] }
    const nonce = randomBytes(16).toString('base64')
    const script = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.js'))
    const style = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.css'))
    view.webview.html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${style.toString()}">
<title>CurupiraCode</title>
</head>
<body>
<header class="toolbar">
  <select id="model" aria-label="Modelo"></select>
  <button id="new" class="secondary" title="Nova conversa">Nova</button>
  <button id="full" class="secondary" title="Abrir a interface completa no navegador">Web</button>
</header>
<main id="log" aria-live="polite"></main>
<footer>
  <p id="status" role="status"></p>
  <textarea id="input" rows="3" placeholder="Pergunte ao CurupiraCode… (Enter envia, Shift+Enter quebra linha)"></textarea>
  <div class="actions">
    <label><input id="editor" type="checkbox" checked> Incluir arquivo ou seleção do editor</label>
    <button id="stop" class="secondary" hidden>Parar</button>
    <button id="send">Enviar</button>
  </div>
</footer>
<script nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`
    view.webview.onDidReceiveMessage((message: FromPanel) => { this.onMessage(message) })
    view.onDidDispose(() => { this.view = undefined })
  }

  post(message: ToPanel): void {
    void this.view?.webview.postMessage(message)
  }

  reveal(): void {
    this.view?.show(true)
  }
}

/**
 * Register the chat view and commands.
 * @param context - extension lifetime and storage.
 */
export function activate(context: vscode.ExtensionContext): void {
  const config = (): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration('curupiracode')
  // The host posts to the view provider, which needs the controller the host feeds.
  const panel: { provider?: ChatViewProvider } = {}
  const host: ControllerHost = {
    workspaceFolders: () => (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath),
    installPath: () => config().get<string>('installPath', ''),
    nodePath: () => config().get<string>('nodePath', ''),
    model: () => config().get<string>('model', 'gemini/gemini-4-argon-low'),
    setModel: async (id) => { await config().update('model', id, vscode.ConfigurationTarget.Global) },
    savedSession: () => context.workspaceState.get<string>(SESSION_KEY),
    saveSession: async (id) => { await context.workspaceState.update(SESSION_KEY, id) },
    newSessionId: () => randomUUID(),
    editorContext: activeEditorContext,
    openFull: () => { void vscode.env.openExternal(vscode.Uri.parse(config().get<string>('webUrl', 'http://127.0.0.1:3080'))) },
    openLink: (url) => { void vscode.env.openExternal(vscode.Uri.parse(url)) },
    pickInstallation: async (message) => {
      const choice = await vscode.window.showWarningMessage(message, 'Escolher pasta')
      if (choice === undefined) return undefined
      const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Usar esta pasta' })
      const path = picked?.[0]?.fsPath
      if (path !== undefined) await config().update('installPath', path, vscode.ConfigurationTarget.Global)
      return path
    },
    post: (message) => { panel.provider?.post(message) },
  }
  const controller = new ChatController(host)
  const handle = (message: FromPanel): void => {
    controller.handle(message).catch((error: unknown) => {
      void vscode.window.showErrorMessage(`CurupiraCode: ${error instanceof Error ? error.message : String(error)}`)
    })
  }
  const provider = new ChatViewProvider(context.extensionUri, handle)
  panel.provider = provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('curupiracode.newConversation', () => { handle({ type: 'newConversation' }) }),
    vscode.commands.registerCommand('curupiracode.openFullInterface', () => { handle({ type: 'openFull' }) }),
    vscode.commands.registerCommand('curupiracode.stop', () => { handle({ type: 'stop' }) }),
    vscode.commands.registerCommand('curupiracode.askAboutSelection', async () => {
      const question = await vscode.window.showInputBox({ prompt: 'O que você quer perguntar sobre a seleção?', value: 'Explique este código.' })
      if (question === undefined) return
      // Send before focusing the view, so the message reads the selection of the editor the command ran in.
      handle({ type: 'send', text: question, includeEditor: true })
      await vscode.commands.executeCommand(`${VIEW_ID}.focus`)
      provider.reveal()
    }),
    { dispose: () => { void controller.dispose() } },
  )
}

/** Nothing to do: the controller's disposable stops the runtime. */
export function deactivate(): void {}
