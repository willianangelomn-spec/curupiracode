# Agent Note：基于 SDK 运行时的 CurupiraCode VS Code 扩展

状态：已实现

[English](2026-10-22-curupiracode-vscode-extension.md) | 中文

## 问题

CurupiraCode 用户希望在 VS Code 中使用智能体，并且拥有与 Web 界面相同的提供方，包括通过 Antigravity CLI 使用的 Gemini 4 Argon。Web 界面不能直接嵌入：自基础升级到 DeepSeek Harness 0.2 起，浏览器只有在同源页面上携带 `SameSite=Strict` 会话 cookie 时才能访问 `/api`，而 VS Code webview 会把 localhost 页面作为跨站框架加载，该 cookie 永远不会被发送。

## 决策

`apps/vscode-extension` 是一个拥有自己聊天 webview 视图的 VS Code 扩展。扩展宿主在第一个工作区文件夹中把用户已构建的 CurupiraCode 检出作为 SDK 运行时（`apps/cli/lib/bin.js --profile sdk`）启动，并通过 `@deepseek-ai/dsh-sdk-protocol` 的 `JsonRpcLineTransport` 使用 SDK 协议。`initialize` 为每个进程固定提供方/模型路由，因此切换模型会停止运行时，下一条消息会在新路由上启动运行时，并用 `session/resume` 恢复已保存的对话。对话条目来自 `session.event` 通知（`assistant/message`、`tool/call`、失败的 `turn/end`），忙碌状态来自 `session.status`。

运行时在系统 Node.js 上运行，绝不在扩展宿主的 Electron Node 上运行，因为检出的原生模块是为系统 Node ABI 构建的。扩展依次通过 `curupiracode.nodePath`、登录 shell 和常见安装路径寻找 Node，并把 Node 所在目录和 `~/.local/bin` 放在运行时 `PATH` 的最前面，使 VS Code 未继承 shell 环境启动时也能找到 agy。可选的编辑器上下文（选区或整个文件，加围栏并有上限）会附加在用户消息后面，这是不读取文件的 agy 模型看到代码的方式。

扩展以 `.vsix` 发布，由 `scripts/build.mjs` 使用 esbuild 和 `@vscode/vsce` 构建。工作区 `package.json` 保持仓库版本和命名规则；`extension.manifest.json` 保存 VS Code 清单及其自己的版本。工作区约束把 `apps/browser-extension` 和 `apps/vscode-extension` 视为以商店包形式发布、不向 npm 发布任何内容的应用。

## 考虑过的替代方案

**在 webview 或 Simple Browser 中嵌入 Web 界面。** 已否决，因为 0.2 连接要求的 cookie 不会发送给跨站框架，而注入该 cookie 的本地代理会把 owner 访问权交给任何能访问代理端口的本地页面。

**复用 `@deepseek-ai/dsh-sdk-client` 的 `HarnessClient`。** 已否决，因为它的公开构造函数总是启动 `process.execPath`，在 VS Code 中那是 Electron，而它的运行时覆盖参数不属于公开签名。

**向 VS Code 的 Chat 视图贡献聊天参与者。** 已否决，因为该视图依赖 Copilot Chat 扩展及其登录，而 CurupiraCode 用户可能没有。

## 影响

检出组合的每个提供方都能在 VS Code 中使用而无需其他密钥，Web 界面和扩展共享同一个检出及其登录。SDK 协议限制了扩展：没有审批提示（需要审批的操作以关闭方式失败）、无法取消轮次（**Parar** 会结束运行时）、重新加载后无法读取历史，也没有逐 token 流式输出。用户必须保留一个已构建的检出；扩展会报告缺失或未构建的检出并请用户选择文件夹。
