# @deepseek-ai/dsh-knowledge-extract-pdf

[English](README.md) | 中文

基于 Mozilla `pdfjs-dist` 的 Curupira Memória PDF 提取器。它提取页面文本并记录 `p. 7` 等页面定位信息，使检索段落能够引用用户可核对的位置。

## 行为

该插件延迟加载 PDF.js，向其提供可丢弃的字节副本，按顺序提取页面，并向 `ctx.knowledge` 注册 `pdf` 提取器。提取完成后，原始字节仍可用于持久存储。

## 模型体验

### PDF 提取

#### 模型所见

模型不会直接看到任何内容。搜索消费方之后可以向模型展示带有 PDF 名称、来源、偏移和 `p. 7` 等 `locator` 页面定位信息的提取段落。

#### Token 影响

PDF 解析不使用模型 token。只有为后续请求选中的段落会增加文本 token。

#### KV Cache 影响

没有直接影响。检索到的 PDF 段落仅在消费方插入它们的位置改变请求。

## 已知限制与后续工作

- 仅含图片的扫描 PDF 需要 OCR，而该包不执行 OCR。
- 阅读顺序遵循 PDF.js 文本提取结果，对复杂多栏布局可能不够准确。
- 受密码保护或格式损坏的 PDF 会明确提取失败。
