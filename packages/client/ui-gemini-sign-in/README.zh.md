---
description: "在模型页上让 Antigravity CLI 登录 Google，面向希望无需终端即可使用 Gemini 的用户，以及 Gemini 适配器的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-gemini-sign-in

[English](README.md) | 中文

## 摘要

此包在 **设置 → 模型** 的 **Google Gemini** 卡片中加入 Google 登录。卡片显示本地 Antigravity CLI（`agy`）是否已保存 Google 登录；**使用 Google 登录** 链接到 Google 的授权页面，最后 Google 显示的代码再粘贴回卡片。登录由 agy 自己保存，因此 [Gemini 适配器](../../llm/llm-gemini/README.zh.md) 无需 API key 即可使用。没有 agy 时，卡片显示安装命令。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发者备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

CurupiraCode Web 组合包在模型页之后挂载该插件：

```yaml
- id: ui-gemini-sign-in
  name: '@deepseek-ai/dsh-client-ui-gemini-sign-in'
```

1. 打开 **设置 → 模型**，找到 **Google Gemini**。
2. 选择 **使用 Google 登录**，然后选择 **打开 Google 登录页面** 并允许访问。
3. 复制 Google 最后显示的代码，粘贴到 **授权代码**，然后选择 **确认**。

卡片与适配器从同样的位置读取 agy：`GEMINI_AGY_BINARY`，然后 `~/.local/bin/agy`，再然后 `PATH`。整个服务器同一时间只运行一个登录；开始新的登录会取代正在等待代码的那个。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

[`src/agy-auth.ts`](src/agy-auth.ts) 以 `AGY_CLI_CDE_AUTH_ACTION` 运行 agy：`check` 仅在已保存登录时以 0 退出，`login` 打印 Google URL，从 stdin 读取一行代码且没有时间限制，保存登录后以 0 退出。每次运行都使用一个空的私有工作目录。[`src/index.ts`](src/index.ts) 是 `geminiSignIn` Remote：`status`、`begin`、`complete` 和 `cancel`，被拒绝的代码报告为 `signed-out` 并附上 agy 的最后一行输出。[`src/client/index.ts`](src/client/index.ts) 挂载该 Remote，并为 `llm-gemini` 行填充带键的 `settings.models.provider-card` 插槽；[`src/client/GeminiSignIn.tsx`](src/client/GeminiSignIn.tsx) 渲染各个状态。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [llm-gemini](../../llm/llm-gemini/README.zh.md)——通过已登录的 agy 提供 Gemini 的适配器。
- [ui-settings-models](../ui-settings-models/README.zh.md)——声明此插件填充的提供方卡片插槽。
- [API Gateway](../../api/gateway/README.zh.md)——承载 `geminiSignIn` Remote。

-----

<a id="model-experience"></a>
## 模型体验

无，此包让 agy 登录 Google，不向模型请求提供任何内容。

#### KV Cache 影响

无；此包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- **卡片跟随内置行 id**——模型页按设置命名空间为提供方卡片设键，此插件填充 `llm-gemini` 卡片；以其他 id 挂载的 Gemini 行不会显示登录。
- **登录协议归 agy 所有**——卡片依赖 agy 1.4.5 实现的 `AGY_CLI_CDE_AUTH_ACTION` 操作；之后若 agy 改变它们，需要更新此包。

<a id="dev-note"></a>
### 开发者备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
