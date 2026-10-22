---
description: "通过本地已登录的 Antigravity CLI 使用 Google Gemini，面向希望无需 API key 使用 Gemini 4 Argon 等 Gemini 模型的用户，以及适配器的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-gemini

[English](README.md) | 中文

## 摘要

该适配器通过 **Google 账号登录**而不是 API key 提供 Google **Gemini**。首选传输是本地已安装并完成登录的 Antigravity CLI（`agy`）；当该二进制文件不存在时，已有的 Google OAuth 授权可以提供 Code Assist 回退。`gemini` 路由附带以 Gemini 4 Argon 为首的精选目录，`models` 设置可以加入本地 CLI 接受的任何其他 id。

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

基础组合包会挂载该适配器，因此 CurupiraCode 安装只需要 CLI：

1. 安装 Antigravity CLI，并在终端运行一次 `agy`，用 Google 账号登录。
2. 在模型选择器中选择 **Google Gemini** 提供方的模型。

```yaml
- id: llm-gemini
  name: '@deepseek-ai/dsh-llm-gemini'
  config:
    # 本地 CLI 接受的额外 id（用 `agy models` 列出）。
    models:
      - id: claude-opus-5-5-thinking
        name: Claude Opus 5.5 (Thinking)
```

### 选择模型

内置目录遵循 `agy`，推理强度是 id 的一部分：Gemini 4 Argon（`gemini-4-argon-high`、`-medium`、`-low`）、Gemini 3.8 Flash、Gemini 3.7 Flash、Gemini 3.6 Flash、Gemini 3.5 Flash、Gemini 3.1 Pro，以及编写目录时 CLI 提供的 Claude 和 GPT-OSS id。Gemini 条目接受文本和图片输入；其他条目仅支持文本。可用的 id 取决于你的 Google 方案和 CLI 版本：Gemini 4 Argon 需要 agy 1.4.3 或更高版本以及包含该模型的方案。agy 不认识某个 id 时会静默改用默认模型作答；适配器会以 `UNKNOWN_MODEL` 拒绝该回答，并说明如何修复。

### 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `models` | `[]` | 加入目录的模型；与内置 id 相同的条目会原位替换。每个条目包含 `id`，以及可选的 `name`、`contextWindow`（默认 1,048,576）和 `images`（默认 false）。 |
| `requestImagePixelBudget` | `4194304` | 每张请求图片的像素数（2048 × 2048）。 |
| `requestImageMaxBytes` | `4194304` | 每张请求图片的编码字节数。 |
| `maxRequestImageBytes` | `20971520` | 每个请求的 base64 图片负载；超出时请求会要求对话卸载最旧的图片。 |
| `retryPolicy` | `null` | 提供方自有的重试策略；`null` 使用重试五次的普通模式。 |

`GEMINI_AGY_BINARY` 覆盖 CLI 路径（默认 `~/.local/bin/agy`），`GEMINI_OAUTH_CLIENT_ID` 覆盖回退传输的 OAuth 客户端。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

[`index.ts`](src/index.ts) 注册 `gemini` 路由、其可配置提供方目录条目、基于有效目录的模型发现，以及授权接缝上的 Google 登录流程。[`agy.ts`](src/agy.ts) 把请求扁平化为一个 `agy -p` 提示词，把请求图片暂存为私有临时文件，以 `@path` 引用并通过 `--add-dir` 授权，然后解析 JSON 结果。[`convert.ts`](src/convert.ts) 为回退构建 Code Assist `streamGenerateContent` 请求体：tool 角色消息成为以所回答的助手调用命名的 `functionResponse` 部分，连续结果共用一个轮次，图片以 `inlineData` 发送。[`images.ts`](src/images.ts) 读取确定性的请求版本，并与其他适配器一样以 `IMAGE_OFFLOAD_REQUIRED` 失败，而不是自行丢弃图片。[`models.ts`](src/models.ts) 保存内置目录，并把配置的模型合并到其上。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [llm](../llm/README.zh.md)——提供方中立的请求词汇和适配器契约。
- [llm-pi-ai](../llm-pi-ai/README.zh.md)——通过 pi-ai 的 `google` 提供方使用 `GEMINI_API_KEY` 访问 Gemini。
- [authorization](../../credentials/authorization/README.zh.md)——承载回退登录流程的接缝。

-----

<a id="model-experience"></a>
## 模型体验

### Gemini 请求

#### 模型所见

通过 `agy` 时，模型收到一个扁平化提示词：先是系统文本，然后是按角色标注的对话，每张保留图片在原始位置以私有 `@path` 引用。通过回退时，模型收到包含系统指令、`functionCall` 与 `functionResponse` 配对以及 `inlineData` 图片的 Gemini `contents`。每张图片前都有稳定附件句柄和请求尺寸；对话已卸载的图片显示为确定性占位符。

#### Token 影响

Gemini 决定文本和图片的 token 化。保留图片消耗视觉 token；句柄增加少量文本成本，占位符则避免重复发送较旧的图片。

#### KV Cache 影响

未变化的请求前缀和确定性图片投影可继续符合提供方缓存复用条件。更改模型、提示词、图片策略或更早消息，会从第一个变化位置起阻止复用。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- **agy 传输只返回文本**——CLI 运行自己的智能体并返回一段最终文本，因此由 `agy` 服务的 Gemini 会话不提供 harness 工具（文件、shell、网络）；Code Assist 回退可以携带函数调用。
- **登录在终端中完成**——注册在授权接缝上的 Google 登录流程在 Web 客户端中还没有入口；运行 `agy` 登录。
- **目录为手写**——id 遵循编写时的 `agy models`；更新的 id 通过 `models` 加入。
- **图片只作为输入**——原生图片生成需要独立的 Gemini 图片模型和传输。

<a id="dev-note"></a>
### 开发者备注

<details>
<summary>维护者工作上下文——点击展开</summary>

- 待 `agy models` 的输出格式有文档后，在发现阶段解析它即可去掉手写目录。

</details>
