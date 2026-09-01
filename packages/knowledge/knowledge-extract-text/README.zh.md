# @deepseek-ai/dsh-knowledge-extract-text

[English](README.md) | 中文

Curupira Memória 内置的纯文本、Markdown、HTML 和 DOCX 提取器。该插件向 `ctx.knowledge` 注册所有提取器，不添加远端服务或 API 凭据。

## 支持的内容

- 纯文本和 Markdown 保留可读源文本。
- HTML 在索引前移除非内容标记。
- DOCX 从归档内的文档 XML 中提取文本。

## 模型体验

### 文本提取

#### 模型所见

模型不会直接看到任何内容。提取器向 `ctx.knowledge` 返回规范化文本和区域；后续搜索消费方决定哪些段落进入模型。

#### Token 影响

提取过程不消耗模型 token。只有其他包把检索文本加入模型请求时，它才影响 token。

#### KV Cache 影响

没有直接影响。只有消费方把变化后的提取段落插入后续请求时，该变化才会产生影响。

## 已知限制与后续工作

- 该包不执行 OCR，也不提取仅存在于图片中的文字。
- DOCX 支持以文档文本为目标，不保留精确的 Word 布局、批注或修订记录。
- 格式损坏或加密的文档会提取失败，而不会生成推测性文本。
