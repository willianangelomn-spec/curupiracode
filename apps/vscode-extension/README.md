# CurupiraCode extension for VS Code

English | [中文](README.zh.md)

A VS Code extension with a CurupiraCode chat view in the activity bar. It starts the local CurupiraCode checkout as an SDK runtime (`dsh --profile sdk`) in the open folder and talks to it over newline-delimited JSON-RPC on stdio, so every provider the checkout composes works here, including Gemini 4 Argon through the Antigravity CLI. It contains no API key.

## Build and install

1. Clone and build CurupiraCode (`pnpm install && pnpm run build`); the extension runs `apps/cli/lib/bin.js` from that checkout.
2. Run `pnpm --filter @deepseek-ai/dsh-vscode-extension package` from the repository root. It writes `apps/vscode-extension/curupiracode-<version>.vsix`.
3. In VS Code, run **Extensions: Install from VSIX…** and pick that file, or run `code --install-extension apps/vscode-extension/curupiracode-<version>.vsix`.

The extension looks for the checkout in `curupiracode.installPath`, then in the open folder, then in `~/curupiracode`, and asks for the folder when none is built. A configured path that is not a built checkout is reported, never replaced. It runs the checkout on the system Node.js (`curupiracode.nodePath`, otherwise the login shell's `node`), because VS Code's own Node build cannot load the native modules the checkout installed. Node's directory and `~/.local/bin` (where the Antigravity installer puts `agy`) go first on the runtime's `PATH`.

## Use

The view's model list starts with Gemini 4 Argon (Low), the default of `curupiracode.model`; it also offers Gemini 3.8 Flash, the Claude models agy serves, and DeepSeek V4 with an API key. Any other `provider/model` value of the setting joins the list. The runtime's `initialize` request fixes the route for the whole process, so choosing another model stops the runtime, and the next message starts one on the new route and resumes the conversation.

The view's copy is Brazilian Portuguese. **Incluir arquivo ou seleção do editor** (include file or selection) appends the active editor's selection, or its whole file when nothing is selected, as a fenced block with its workspace-relative path and lines, cut at 60,000 characters. Models served through agy answer in text only and read no files, so this option is how they see code. **CurupiraCode: Ask about the selection** in the editor context menu sends the selection with a question. **Nova** starts another conversation; **Web** opens `curupiracode.webUrl`. The conversation id is stored per workspace.

## Model Experience

### VS Code message

#### What the model sees

The user message the runtime receives is the typed text, followed, when the option is on, by `Contexto do editor (<lines or file> <path>):` and the fenced editor text. Everything else the model sees is the runtime's composition for the selected route, as in the SDK profile.

#### Token effect

Editor context adds the selected text, bounded at 60,000 characters per message.

#### KV Cache effect

Each message carries its own editor text, so earlier turns keep their prefix; changing the model starts another runtime, whose first request rebuilds the cache.

## Known Limitations and Deferred Work

- The SDK protocol has no server-to-client requests, so the view cannot answer approval prompts; operations that need approval fail closed, while edits inside the workspace follow the base file policy.
- The SDK protocol has no prompt cancel; **Parar** (stop) ends the runtime process, and the next message resumes the conversation.
- The SDK protocol has no history read; a conversation resumed after a window reload keeps its model context, but the view does not show earlier messages.
- Assistant text arrives when the model message is committed, not token by token.
