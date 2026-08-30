# CurupiraCode SearXNG 搜索

[English](README.md) | 中文

一个可移植、无需凭据的 `web_search` 提供方，由运营者控制的 [SearXNG](https://docs.searxng.org/) 实例提供支持。CurupiraCode 将查询发送到 SearXNG 的 JSON 搜索 API，并把响应映射到共享的 `ctx.web` seam。

## 存在理由

DuckDuckGo HTML 仍是 CurupiraCode 的零配置默认项；本包则为社区、学校、团队和本地部署提供更可控的开源搜索后端，无需把项目绑定到付费模型或搜索 API。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `baseURL` | `$SEARXNG_URL` | 已启用 JSON 输出的 SearXNG 实例根 URL。为空或缺失时此提供方不可用。 |
| `categories` | `['general']` | 每次查询发送的 SearXNG 分类。 |
| `language` | 实例默认值 | 可选语言代码，例如 `pt-BR`。 |
| `engines` | 实例默认值 | 可选引擎允许列表。 |
| `safeSearch` | 实例默认值 | 可选级别：`0`、`1` 或 `2`。 |
| `timeRange` | 未设置 | 可选的 `day`、`month` 或 `year` 过滤条件。 |
| `timeoutMs` | `15000` | 每次请求的截止时间（毫秒）。 |

在启动环境中设置端点，并在 web 行中选择该提供方：

```sh
export SEARXNG_URL=http://127.0.0.1:8080/
```

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: searxng

- id: web-search-searxng
  name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    language: pt-BR
    categories: [general, news]
    safeSearch: 1
```

SearXNG 实例必须允许 `format=json`。请参阅官方[搜索 API](https://docs.searxng.org/dev/search_api.html)和[容器安装](https://docs.searxng.org/admin/installation-docker.html)文档。CurupiraCode 不会硬编码公共实例，也不会在后台静默路由到公共实例。

## 映射与安全

提供方以表单编码方式向 `/search` 发送查询，拒绝 HTTP 重定向，只接受绝对 HTTP(S) 结果 URL，移除重复项，并把 `title`、`content` 和发布日期映射到可移植结果字段。调用方取消会呈现为 `WEB_ABORTED`；端点、超时、HTTP、解析和响应结构失败会呈现为 `WEB_PROVIDER_ERROR`。

## 模型体验

通过 [`dsh-tool-web`](../tool-web/README.zh.md) 间接影响；该工具在消费方错误包装层中呈现本提供方规范化的答案文本、URL、标题、摘要和发布日期，或稳定的 web 提供方错误。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

## 已知限制与暂缓事项

- **需要一个正在运行的 SearXNG 端点**：本适配器不安装或运维该服务。
- **实例运营者可以禁用 JSON 输出**：在启用 `format=json` 前，该端点无法为本提供方服务。
- **不会自动选择公共实例**：可用性和 API 策略各不相同，因此运营者必须选择自己信任的端点。
- **SearXNG 专有排名元数据保留在适配器内部**：只有与提供方无关的 web 字段进入模型上下文。
