# Agent Note：基于 DeepSeek Harness 0.2 的 CurupiraCode

状态：已实现

[English](2026-10-22-curupiracode-dsh-0-2-base.md) | 中文

## 问题

CurupiraCode 过去把大量产品行为直接改写在上游包内：Web 外壳品牌、语言表、模型页的登录卡片、会话控制器以及连接层的 CORS 处理。DeepSeek Harness 0.2 用 Typert 网关取代了 `/api/<method>` RPC，把浏览器访问放到启动令牌和签名 cookie 之后，把语言注册改为 `ctx.locale.addLanguage`，移除了运行时不变量，并把工具结果改为 `role: 'tool'` 消息。重新套用这些就地修改会与上述大部分变化冲突，其中一些修改在上游已没有可挂接的位置。

## 决策

分支以一次压缩合并跟进上游：把上游标签 `dsh-v0.2.1-rc.2` 压缩到此前的 CurupiraCode 代码树之上。CurupiraCode 特有的行为放在由组合包行挂载的 CurupiraCode 自有包中，因此上游文件只承载组合行和包约定方面的改动：

- `@deepseek-ai/dsh-client-ui-brand-curupira` 取代 Web 组合包中的 `ui-brand-official` 行。它填充侧边栏和首屏的品牌插槽，并把森林绿配色作为主题覆盖层挂到静态强调色阶上，因此所有内置主题和插件主题都保留各自的界面表面。
- `@deepseek-ai/dsh-client-ui-language-pt-br` 位于 `locale` 行之后。它添加以英文为回退的 `pt-BR`，并为每个命名空间注册一个词典。每个词典都以 `satisfies` 对齐其命名空间的类型化键集，因此上游新增、重命名或删除某个键时，客户端类型检查会失败，直到语言包跟进。
- `browser` 与 `browser-chat` 预设是 Web 组合包的预设补丁文件，`knowledge-tools` 行位于 `standard`、`ptc` 和 `cordis` 预设中，因此不含工具的浏览器预设无法读取知识库。
- `@deepseek-ai/dsh-llm-gemini` 使用 0.2 的 LLM 契约：tool 角色消息成为 `functionResponse` 部分，超出请求预算的图片以 `IMAGE_OFFLOAD_REQUIRED` 失败，目录以 Gemini 4 Argon 开头。它的 `models` 字段是易变字段，目录条目报告无需密钥的原生认证，因此 **设置 → 模型** 会列出 Google Gemini 且不显示密钥字段。
- 知识库、DuckDuckGo 搜索、SearXNG 搜索和 Cyberpunk 主题包遵循 0.2 的包约定：不再有不变量配套包，Typert 参数带显式注解，并采用当前的客户端包布局。

### 撤回的功能

- [语义记忆说明](../feature/2026-08-30-curupira-semantic-memory-and-session-deletion.zh.md)中决定的永久删除会话功能已撤回。它是对会话控制器的修改，而 0.2 的控制器是 Typert Remote，其会话生命周期和 Remote 访问规则归上游所有。归档是唯一的移除操作。
- [浏览器扩展说明](../feature/2026-08-31-curupiracode-browser-extension.zh.md)中的 `trustedExtensionIds` CORS 桥接已撤回。0.2 的连接只接受携带浏览器 cookie 或 Peer 凭据的同源 `/api` 请求，因此扩展的请求会收到 HTTP 403。替代方案是带可见令牌配对的宿主桥接，记录在路线图的浏览器里程碑中。
- 运行适配器自有 Google OAuth 流程的 Gemini 登录卡片已撤回，因为 0.2 的模型页没有承载授权接缝流程的界面。`@deepseek-ai/dsh-client-ui-gemini-sign-in` 取而代之：它填充 `llm-gemini` 行的带键 `settings.models.provider-card` 插槽，并通过 agy 的 `AGY_CLI_CDE_AUTH_ACTION` check 与 login 操作让 agy 自己登录，因此提供 Gemini 的传输拥有该登录。Google OAuth 流程仍注册在授权接缝上，供 Code Assist 回退使用。

## 考虑过的替代方案

**把之前的就地补丁重新套用到新上游。** 已否决，因为之后每次同步都会在相同文件中冲突，而且语言表和会话控制器在 0.2 中已改变结构。

**连同完整历史合并上游。** 已否决，因为 CurupiraCode 的历史始于一个不含上游祖先的快照。真正的合并会把数千个上游提交引入一个从未包含它们的仓库；从记录的上游标签压缩合并能让分支历史保持线性，并让下一次同步可以重复。

**通过转发所有 owner Remote 的通用代理移植扩展。** 已否决，因为这会让扩展来源在没有人工批准的配对步骤时获得等同 owner 的访问权。该桥接需要单独设计和审查。

## 影响

上游同步现在只在组合包行、预设文件和包约定处触及 CurupiraCode，而不是在上游组件内部。每当上游修改已翻译的命名空间时，pt-BR 语言包都必须更新，类型检查会准确报告哪些键发生了变化。在配对桥接完成之前，用户失去永久删除会话功能和扩展的服务器连接；根 README 和扩展 README 说明了这一缺口。Gemini 用户在 Gemini 卡片中登录，该卡片依赖 agy 1.4.5 实现的认证操作。
