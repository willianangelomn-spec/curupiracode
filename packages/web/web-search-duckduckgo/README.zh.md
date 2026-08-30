# CurupiraCode DuckDuckGo 搜索

[English](README.md) | 中文

这是一个无需密钥的 `web_search` 提供方。它查询 **DuckDuckGo** HTML；当主引擎失败或没有结果时回退到 **Bing** HTML，并把普通结果与 **Google News** RSS 新闻合并。无需任何商业服务凭据。

## 为什么需要它

CurupiraCode 应当从首次运行起即可搜索。该包让本地安装无需订阅其他服务或保存额外密钥，也能使用搜索。其多引擎回退方向受到 [dsh-free-web-search](https://github.com/delef/dsh-free-web-search) 启发；本包仍是在 Harness `ctx.web` seam 上的独立实现。

## 结果

- DuckDuckGo 普通结果排在前面；重定向会展开，广告会丢弃。
- 只有 DuckDuckGo 失败或没有可用结果时，Bing 才会替代普通结果来源。
- 最多由 `googleNewsMax` 条新闻补充列表，并携带发布时间。
- 重复 URL 会被移除，`maxResults` 上限会被遵守。

## 配置

| 字段 | 默认值 |
| --- | --- |
| `baseURL` | `https://html.duckduckgo.com/html/` |
| `newsBaseURL` | `https://news.google.com/rss/search` |
| `bingBaseURL` | `https://www.bing.com/search` |
| `bingMarket` | `pt-BR` |
| `fallbackToBing` | `true` |
| `locale` | `pt-BR`（Google News `hl`） |
| `country` | `BR`（Google News `gl`/`ceid`） |
| `includeGoogleNews` | `true` |
| `googleNewsMax` | `3` |
| `timeoutMs` | `15000` |

所有字段均为可选。CurupiraCode 默认 bundle 已加载该提供方并选择 `duckduckgo-html`。

## 手动加载

```yaml
- insert:
    - id: web-search-duckduckgo
      name: '@deepseek-ai/dsh-web-search-duckduckgo'
- id: web
  config:
    searchProvider: duckduckgo-html
```

内部标识 `@deepseek-ai/dsh-web-search-duckduckgo` 在当前阶段保留，以兼容继承的插件生态；对外品牌和发行版名称均为 CurupiraCode。

## 模型体验

通过 [`dsh-tool-web`](../tool-web/README.zh.md) 间接影响；该工具呈现规范化的普通／新闻 URL、标题、摘要、发布日期和稳定的提供方错误。模型无需选择或重试引擎；回退是在结果到达工具前完成的实现细节。

#### KV Cache 影响

不会直接导致 KV Cache 失效；请求前缀变更由上述消费方负责。

## 已知限制与暂缓事项

- **HTML 布局可能随时变化**：当 DuckDuckGo 或 Bing 修改标记时，由固定样例覆盖的解析器可能需要维护。
- **公共端点可能限制自动流量**：提供方会报告组合后的普通搜索失败，不承诺商业 SLA。
- **Google News 是可选增强项**：RSS 故障不会破坏可用的普通搜索。
- **只尝试一次回退**：运营者控制的 SearXNG 作为独立提供方提供，而不会静默路由到公共实例。
