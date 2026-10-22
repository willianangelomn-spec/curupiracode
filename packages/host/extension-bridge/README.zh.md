---
description: "CurupiraCode 浏览器扩展的 Host 桥接：已登录 Web 服务器上的配对页面为一个允许的扩展 origin 签发可撤销的令牌，一组固定的回环端点让该 origin 驱动无工具的浏览器预设 Session，并向 Curupira Memory 添加文档。"
kind: "package-reference"
---

# @deepseek-ai/dsh-host-extension-bridge

[English](README.md) | 中文

## 概述

[CurupiraCode 浏览器扩展](../../../apps/browser-extension/README.zh.md)运行在 `chrome-extension://` origin 上，而 Connection 的 `/api` 防护按设计拒绝这种 origin。本包在 Web 服务器上为该 origin 提供一组专属路由。已登录 CurupiraCode 的用户在 `/extension-bridge/pair` 上批准扩展并获得配对令牌；之后扩展携带该令牌调用一组固定的 `v1` 端点，创建、提示、读取和取消运行已配置浏览器预设的 Session，并向 Curupira Memory 添加文档。其他 origin、伪造的 Host、缺失或已撤销的令牌，以及预设未获准的 Session 都会被拒绝。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

`dsh-web-app` bundle 以 `extension-bridge` 行挂载本插件，配置为由扩展 manifest 派生的 origin 以及 `browser` 和 `browser-chat` 预设。插件等待 `webServer`、`connection`、`credentials`、`typertGateway` 和 `sessionController`；`knowledge` 为可选。

### 配置

| 字段 | 含义 |
|---|---|
| `allowedOrigins` | 必填。配对页面提供的精确 `chrome-extension://<32 个字母的 id>` origin；空列表或任何其他值都会使插件加载失败。 |
| `agentPresets` | 必填。扩展可用于创建并持续驱动 Session 的预设；空列表会使插件加载失败。 |
| `maxRequestBodyBytes` | 缓冲 JSON 请求体的最大字节数。默认 160 MiB，可容纳五张 base64 编码的 20 MiB 图片和提示文本。 |
| `maxDocumentBytes` | `knowledge/ingest` 文档解码后的最大字节数。默认 20 MiB。 |
| `maxDocumentTextChars` | `knowledge/ingest` 返回的提取文本最大字符数。默认 120000 个字符。 |
| `maxHistoryMessages` | `sessions/messages` 返回的最多消息数。默认 100。 |

### 配对

`GET /extension-bridge/pair` 显示每个允许的 origin、其配对时间以及令牌授予的能力。**Aprovar e gerar código**（或 **Gerar novo código**）按钮会回传该 origin，并在响应中只显示一次令牌；再次批准会替换之前的令牌，**Revogar** 则将其移除。扩展使用 `chrome.tabs.create` 打开此页面，因此这次导航会携带浏览器的 SameSite=Strict 会话 cookie。页面及其两个表单提交都经过 `ctx.connection.admit`，并且必须解析为共享的浏览器 Peer：没有 cookie 的请求收到 HTTP 401 的登录提示页，被 Connection 的 Host/Origin 防护拒绝的请求收到 HTTP 403，来自 `/connect` 的 API 操作员凭据也不被接受。因此扩展自身的 origin 即使附带 cookie 也无法批准自己。

页面不含脚本。其 Content-Security-Policy 只允许带 nonce 的内联样式和同源表单提交，禁止被嵌入框架，响应也从不缓存。referrer 策略为 `same-origin`：在 `no-referrer` 下，浏览器会为页面自身的表单提交发送 `Origin: null`，而 Connection 会拒绝它。

### 端点

每个端点都是 `POST /extension-bridge/v1/<endpoint>`，请求体为 `application/json`，并带有 `Authorization: Bearer <token>` 请求头。请求必须携带回环 `Host`（`localhost`、`[::1]` 或任意 127/8 地址），且 `Origin` 必须等于令牌签发给的那个允许 origin。响应不带 CORS 请求头；扩展页面通过其 host 权限访问回环地址。[`src/types.ts`](src/types.ts) 声明了每个请求和应答。

| 端点 | 请求 | 应答 |
|---|---|---|
| `status` | `{}` | 获准的预设，以及 `knowledge` 是否已挂载 |
| `sessions/create` | `agentPreset`、`title` | 运行该预设并重命名为 `title` 的新 Session 的 `sessionId` |
| `sessions/prompt` | `sessionId`、`requestId`、`content`，可选 `clientTimeZone` | 提示进入队列后返回 `{ accepted: true }` |
| `sessions/reply` | `sessionId`、`requestId` | `queued`、`running`，或已结束回合的状态及其最后一条助手文本 |
| `sessions/messages` | `sessionId` | 最新的用户提示和助手消息，从旧到新 |
| `sessions/cancel` | `sessionId` | 取消请求被接纳后返回 `{ accepted: true }` |
| `knowledge/ingest` | `name`、严格 base64 的 `data`，可选 `format` | 导入结果加上提取文本，截断到 `maxDocumentTextChars` |

`content` 接受文本部分和内联 base64 图片部分。回合以 `completed` 或 `max-tokens` 结束时回复为 `completed`，以 `aborted` 结束时为 `cancelled`，其他结束方式均为 `failed`，并附带回合的原因和消息。

### 拒绝

每次拒绝都应答 `{ "error": { "code", "message" } }`。

| 状态 | 原因 |
|---|---|
| 400 | JSON 无效、请求体与端点不符，或 base64 无效 |
| 401 | 令牌缺失、格式错误或未配对；响应带有 `WWW-Authenticate: Bearer` |
| 403 | 非回环 Host、不允许的 Origin、未获准的预设，或当前预设未获准的 Session |
| 404 | 未知端点或 Session |
| 405、413、415 | 方法错误、请求体或文档超出限制、媒体类型错误 |
| 409 | 需要迁移的 Session；在 CurupiraCode 中打开一次即可完成迁移 |
| 422 | Session Remote 或 knowledge 的失败，带有其自身的代码和消息 |
| 500 | 其他任何失败；消息不暴露内部细节，Host 日志记录该错误 |
| 503 | knowledge 未挂载，或插件正在释放 |

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

### 配对记录

所有配对都保存在一条凭据 grant 记录 `host-extension-bridge/pairings` 中，条目为 `{ origin, tokenSha256, pairedAt }`；令牌本身从不存储。令牌是 base64url 编码的 32 个随机字节，验证时以常数时间比较 SHA-256 摘要。遇到无法读取的记录时激活失败。写入经由 `modifyRecord`，只在提交后才更新内存视图；该记录的 `credentials/record-updated` 通知会触发重新加载，因此其他进程写入的撤销也会在这里生效，而无法读取或格式错误的重新加载会撤销本进程中的所有配对。加载和写入按到达顺序执行。

### Session 工作

插件创建一个 `interactions: 'none'` 的 owner Peer，并以该 Peer 通过 `ctx.typertGateway.invoke` 调用 `session/create`、`session/rename`、`session/prompt`、`session/cancel` 和 `session/projections`。任何 Session 范围的端点执行前，该 Session 当前的 `agentPreset` 投影都必须是获准的预设，因此即使知道带工具 Session 的 id 也会被拒绝。回复和消息读取 `ctx.sessionController.inspect`；回复由来源携带该提示 `requestId` 的用户消息定位，并在其后的第一个 `turn/end` 处结束。

### 生命周期

一条前缀路由服务 `/extension-bridge`。每个请求的 signal 会在客户端断开或插件释放时中止。拆除时先移除路由，再中止并等待已接纳的请求，然后等待已接纳的配对写入。

### 源码地图

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件、`Config`、路由、配对页面准入、失败映射、生命周期 |
| [`src/request-trust.ts`](src/request-trust.ts) | 回环 Host、允许的 Origin 和 bearer 准入 |
| [`src/pairings.ts`](src/pairings.ts) | 持久的配对记录和令牌验证 |
| [`src/operations.ts`](src/operations.ts) | 基于 Session Remote 和 knowledge 服务的 `v1` 端点 |
| [`src/conversation.ts`](src/conversation.ts) | 从 Session 事件投影回复状态和消息 |
| [`src/pairing-page.ts`](src/pairing-page.ts) | 服务器渲染的配对、登录提示和拒绝页面 |
| [`src/http.ts`](src/http.ts) | 有界的请求体读取和响应头 |
| [`src/types.ts`](src/types.ts) | 线上载荷类型 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

阅读这些内容以了解桥接的其他方面：调用它的扩展、配对所复用的防护，以及它调用的 API。

- [CurupiraCode 浏览器扩展](../../../apps/browser-extension/README.zh.md)——进行配对并调用这些端点的侧边栏。
- [Connection](../../client/connection/README.zh.md)——配对页面背后的 Host/Origin 防护和浏览器 cookie。
- [Session Controller](../../api/session-controller/README.zh.md)——端点所调用的 Session Remote。
- [浏览器扩展 Agent Note](../../../.agents/notes/implemented/feature/2026-08-31-curupiracode-browser-extension.zh.md)——为什么桥接配对令牌，而不是信任扩展 id。

-----

<a id="model-experience"></a>
## 模型体验

间接影响由 Session 提示路径拥有：扩展的提示作为普通用户消息进入获准的浏览器预设 Session，请求的其余部分都由该预设组合。

#### KV 缓存影响

无；每个提示像其他用户消息一样追加到其 Session，桥接不向请求前缀添加任何内容。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **轮询回复**——`sessions/reply` 和 `sessions/messages` 每次调用都会复制 Session 的整个事件日志，并在回合结束后才给出回答；扩展轮询它们，收不到流式增量。
- **仅支持 Chromium origin**——`allowedOrigins` 只接受 `chrome-extension://` origin；Firefox 的 `moz-extension://` origin 每次安装 id 都不同，会被拒绝。
- **配对不限制已配对扩展本身**——拥有回环 host 权限的扩展也能对已登录的 Web 界面执行脚本；配对证明的是有人批准了该 origin，而不是其代码的行为。
- **单一语言页面**——配对页面使用巴西葡萄牙语，即打开它的扩展所用的语言。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
