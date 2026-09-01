# @deepseek-ai/dsh-knowledge-tools

[English](README.md) | 中文

Curupira Memória 的 agent 工具。该包让 agent 通过共享知识 seam 摄取已授权的本地文件或文件夹、搜索有依据的段落、列出已存文档并发现语义关系。

## 工具

- `knowledge_ingest` 从一个本地路径索引受支持文件。
- `knowledge_search` 返回带文档来源信息的排序段落。
- `knowledge_documents` 列出知识库内容。
- `knowledge_related` 查找语义相关文档。

文件夹遍历会跳过隐藏目录和构建目录，接受 Markdown、文本、HTML、DOCX 和 PDF，并执行文件数量与字节限制。

## 模型体验

### Curupira Memória 工具

#### 模型所见

模型会收到包括 `knowledge_search` 在内的 4 个工具 schema 和一条系统提示词指令，要求主动搜索用户的存储材料、依据返回段落陈述事实，并引用文档和定位信息，不得虚构证据。

#### Token 影响

工具 schema 会增加稳定的请求成本。工具结果只增加该次调用返回的有界段落文本和来源信息。

#### KV Cache 影响

稳定 schema 会保留其前缀身份。每次工具调用和结果都会追加新内容；变化的结果仅影响插入点之后的复用。

## 已知限制与后续工作

- 一次文件夹遍历最多索引 `500` 个受支持文件，每个文件必须不超过 `20 MiB`。
- 工具只读取本地 Curupira 进程已获授权的路径；它们不提供远端驱动器同步。
- OCR 和不受支持的格式需要额外的提取器插件。
