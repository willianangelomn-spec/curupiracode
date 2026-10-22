# CurupiraCode VS Code 扩展

[English](README.md) | 中文

在活动栏中提供 CurupiraCode 聊天视图的 VS Code 扩展。它在打开的文件夹中把本地 CurupiraCode 检出作为 SDK 运行时（`dsh --profile sdk`）启动，并通过 stdio 上以换行分隔的 JSON-RPC 与其通信，因此检出组合的每个提供方都可在此使用，包括通过 Antigravity CLI 使用的 Gemini 4 Argon。扩展不包含任何 API key。

## 构建与安装

1. 克隆并构建 CurupiraCode（`pnpm install && pnpm run build`）；扩展运行该检出中的 `apps/cli/lib/bin.js`。
2. 在仓库根目录运行 `pnpm --filter @deepseek-ai/dsh-vscode-extension package`。它会写出 `apps/vscode-extension/curupiracode-<version>.vsix`。
3. 在 VS Code 中运行 **Extensions: Install from VSIX…** 并选择该文件，或运行 `code --install-extension apps/vscode-extension/curupiracode-<version>.vsix`。

扩展依次在 `curupiracode.installPath`、打开的文件夹和 `~/curupiracode` 中寻找检出，没有已构建的检出时会请用户选择文件夹。配置的路径不是已构建的检出时会报告，绝不会被替换。它用系统 Node.js（`curupiracode.nodePath`，否则为登录 shell 的 `node`）运行检出，因为 VS Code 自带的 Node 构建无法加载检出安装的原生模块。Node 所在目录和 `~/.local/bin`（Antigravity 安装程序放置 `agy` 的位置）排在运行时 `PATH` 的最前面。

## 使用

视图的模型列表以 Gemini 4 Argon (Low) 开头，这是 `curupiracode.model` 的默认值；列表还提供 Gemini 3.8 Flash、agy 提供的 Claude 模型，以及使用 API key 的 DeepSeek V4。该设置中的任何其他 `provider/model` 值也会加入列表。运行时的 `initialize` 请求为整个进程固定路由，因此选择其他模型会停止运行时，下一条消息会在新路由上启动运行时并恢复对话。

视图文案为巴西葡萄牙语。**Incluir arquivo ou seleção do editor**（包含文件或选区）会把活动编辑器的选区（没有选区时为整个文件）作为带工作区相对路径和行号的围栏代码块附加在后面，并在 60,000 个字符处截断。通过 agy 提供的模型只返回文本、不读取文件，因此这个选项是它们看到代码的方式。编辑器右键菜单中的 **CurupiraCode: 就选区提问** 会把选区和问题一起发送。**Nova** 开始另一段对话；**Web** 打开 `curupiracode.webUrl`。对话 id 按工作区保存。

## 模型体验

### VS Code 消息

#### 模型所见

运行时收到的用户消息是输入的文本；选项开启时，后面依次是 `Contexto do editor (<行号或文件> <路径>):` 和围栏中的编辑器文本。模型看到的其他内容都是所选路由的运行时组合，与 SDK 配置相同。

#### Token 影响

编辑器上下文会加入所选文本，每条消息最多 60,000 个字符。

#### KV Cache 影响

每条消息携带各自的编辑器文本，因此较早的轮次保持其前缀；切换模型会启动另一个运行时，其第一次请求会重建缓存。

## 已知限制与后续工作

- SDK 协议没有服务器到客户端的请求，因此视图无法回答审批提示；需要审批的操作会以关闭方式失败，而工作区内的编辑遵循基础文件策略。
- SDK 协议没有取消提示的方法；**Parar**（停止）会结束运行时进程，下一条消息会恢复对话。
- SDK 协议没有读取历史的方法；窗口重新加载后恢复的对话保留模型上下文，但视图不会显示之前的消息。
- 助手文本在模型消息提交时到达，而不是逐 token 到达。
