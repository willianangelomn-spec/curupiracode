# @deepseek-ai/dsh-llm-gemini

[English](README.md) | 中文

DeepSeek Harness LLM 适配器，通过 **Google 账号登录**而不是 API key 提供 Google **Gemini**。其首选传输是本地已安装并完成认证的 Antigravity CLI（`agy`）；当该二进制文件不存在时，已有的 Google OAuth 授权可以提供 Code Assist 回退。

## 为什么使用独立包

内置多提供方适配器（`llm-pi-ai`）包含 Google 提供方，但该提供方使用静态 `GEMINI_API_KEY` 认证且不提供登录流程。因此，通过登录使用 Gemini 的功能位于独立适配器中。

## 流程

1. 适配器注册 `gemini` 路由、一个可配置提供方目录条目，以及基于精选 Gemini 目录的模型发现。
2. 文本请求会扁平化为 `agy -p` 提示词。支持图片的模型通过私有临时文件、`@path` 提示词引用和请求级 `--add-dir` 权限接收确定性请求尺寸图片。调用结束后会删除临时文件。
3. 如果 `agy` 不可用且已有 OAuth 授权，适配器会使用 Code Assist `streamGenerateContent`；图片以 Gemini `inlineData` 发送。
4. 目录元数据不包含 `image` 输入模态的模型会在提供方执行前拒绝新图片，而不是静默忽略。

## 配置

路由固定为 `gemini`。设置区段（`llm-gemini`）负责提供方重试策略和以下图片限制：

- `requestImagePixelBudget`：每张请求图片的确定性像素数（默认 `4194304`，即 2048 × 2048）。
- `requestImageMaxBytes`：每张请求图片的编码字节数（默认 `4194304`）。
- `maxRequestImageBytes`：请求图片的累计 base64 等效负载（默认 `20971520`）。超出限制的最旧图片会变成稳定文本占位符，而不会改变持久历史。

### OAuth 客户端 id

默认客户端 id 是 Generative Language API 使用的公开 Google 客户端。每个部署可通过以下变量覆盖：

```sh
GEMINI_OAUTH_CLIENT_ID=your-oauth-client-id
```

## 支持的模型

精选目录遵循 `agy` 提供的模型：Gemini 3.7 Flash、Gemini 3.6 Flash、Gemini 3.5 Flash 和 Gemini 3.1 Pro 变体。这些 Gemini 条目声明支持文本和图片输入。Claude 或 GPT-OSS 等目录条目保持仅支持文本，除非其传输已明确验证图片能力。

## 模型体验

### Gemini 请求

#### 模型所见

选中的 Gemini 模型会收到扁平化的系统提示词和对话，每张保留图片位于原始逻辑位置。`agy` 传输看到私有 `@path` 引用，OAuth 回退则接收 `inlineData`。每张图片前都有稳定附件句柄和实际请求尺寸。超过总量限制的图片会变成确定性占位符，而不会被静默丢弃。

#### Token 影响

Gemini 决定精确的文本和图片 token 化。保留图片消耗视觉 token；稳定句柄增加少量文本成本，已卸载占位符则避免重复发送较旧的视觉内容。

#### KV Cache 影响

未变化的请求前缀和确定性图片投影可以继续符合提供方缓存复用条件。更改模型、提示词、图片策略或更早消息，可能从第一个变化位置起阻止复用。

## 已知限制与后续工作

- 首选传输需要可用的本地 `agy` 安装和 Google 登录。在新计算机上安装 CurupiraCode 后先运行一次 `agy`。
- 共享附件层完成规范化和限制后，请求可以引用 PNG、JPEG、WebP 和 GIF 附件。
- 当前 Antigravity 目录接受图片输入，但只返回文本输出。原生图片生成需要独立的 Gemini 图片模型和 API 传输。
- 该适配器是 `llm-pi-ai` 的同级包；两者都由基础组合包挂载。
