# Agent Note: CurupiraCode VS Code extension over the SDK runtime

Status: implemented

English | [中文](2026-10-22-curupiracode-vscode-extension.zh.md)

## Problem

CurupiraCode users want the agent inside VS Code, with the same providers as the Web interface, Gemini 4 Argon through the Antigravity CLI included. The Web interface cannot simply be embedded: since the DeepSeek Harness 0.2 base, the browser reaches `/api` only with a `SameSite=Strict` session cookie on a same-origin page, and a VS Code webview loads a localhost page as a cross-site frame, where that cookie is never sent.

## Decision

`apps/vscode-extension` is a VS Code extension with its own chat webview view. The extension host starts the user's built CurupiraCode checkout as the SDK runtime (`apps/cli/lib/bin.js --profile sdk`) in the first workspace folder and speaks the SDK protocol through `JsonRpcLineTransport` from `@deepseek-ai/dsh-sdk-protocol`. `initialize` fixes the provider/model route per process, so a model change stops the runtime and the next message starts one on the new route and resumes the stored conversation with `session/resume`. Transcript entries come from `session.event` notifications (`assistant/message`, `tool/call`, failing `turn/end`) and the busy state from `session.status`.

The runtime runs on the system Node.js, never on the extension host's Electron Node, because the checkout's native modules are built for the system Node ABI. The extension finds Node through `curupiracode.nodePath`, the login shell, then common install paths, and puts Node's directory and `~/.local/bin` first on the runtime `PATH` so agy resolves even when VS Code started without the shell environment. An optional editor context (selection or whole file, fenced, bounded) is appended to the user message, which is how agy-served models, which read no files, see code.

The extension ships as a `.vsix` built by `scripts/build.mjs` with esbuild and `@vscode/vsce`. The workspace `package.json` keeps the repository version and naming rules; `extension.manifest.json` holds the VS Code manifest and its own version. The workspace constraints treat `apps/browser-extension` and `apps/vscode-extension` as store-packaged applications that publish nothing to npm.

## Alternatives considered

**Embed the Web interface in a webview or Simple Browser.** Rejected because the cookie the 0.2 connection requires is not sent to a cross-site frame, and a local proxy that injected it would hand owner access to any local page that can reach the proxy port.

**Reuse `HarnessClient` from `@deepseek-ai/dsh-sdk-client`.** Rejected because its public constructor always launches `process.execPath`, which inside VS Code is Electron, and its runtime-override parameter is not part of the public signature.

**Contribute a chat participant to VS Code's Chat view.** Rejected because that view depends on the Copilot Chat extension and its sign-in, which CurupiraCode users may not have.

## Consequences

Every provider the checkout composes works in VS Code without another key, and the Web interface and the extension share one checkout and its sign-ins. The SDK protocol limits the extension: no approval prompts (operations that need one fail closed), no turn cancel (**Parar** ends the runtime), no history read after a reload, and no token streaming. Users must keep a built checkout; the extension reports a missing or unbuilt one and asks for the folder.
