<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" alt="CurupiraCode 标志" />
</p>

# CurupiraCode

[Português do Brasil](README.md) | [English](README.en.md) | 中文

**开放的 AI，代码由你掌控。**

CurupiraCode 是一个本地运行、开放且由插件驱动的 AI agent harness。本项目是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的独立派生项目，保留基于 [Cordis](https://github.com/cordiverse/cordis) 的可组合架构，并增加巴西本土身份、葡萄牙语体验以及不绑定单一提供商的集成能力。

## 当前状态

- 基础已同步到 DeepSeek Harness 0.2（`dsh-v0.2.1-rc.2`）：界面与服务器之间的类型化 API、受令牌保护的界面访问、右侧边栏、自动任务和插件管理器；
- CurupiraCode 品牌以品牌插件形式提供，森林绿配色可叠加在任意主题之上；
- 巴西葡萄牙语以语言包形式提供，葡萄牙语浏览器会自动选择它；
- 通过 Antigravity CLI 使用 Google Gemini 4 Argon 及其他 Gemini 模型，无需 API key；
- 集成无需额外密钥的 DuckDuckGo 搜索、Bing 回退与 Google News；
- 可选通过运营者控制的开源 SearXNG 实例进行搜索；
- 提供 Chrome 与 Edge 扩展，包含侧边栏聊天、可审查自动化、表单辅助填写和可移植宏，并通过可见的代码配对连接本地服务器（见 [`apps/browser-extension`](apps/browser-extension/README.zh.md)）；
- 过渡期内兼容 `@deepseek-ai/dsh-*` 插件和配置；
- `curupiracode` 为主命令，`dsh` 为旧版兼容别名。

项目目前处于开发者预览阶段，API 和格式仍可能变化。

<a id="run"></a><a id="run-from-source"></a>

## 从当前源码运行

需要符合 [package.json](package.json) 中 `engines` 要求的 Node.js 和 pnpm。

```sh
pnpm install
pnpm run build
pnpm curupiracode web
```

该命令会打印类似 `http://127.0.0.1:3080/?token=…` 的地址并在浏览器中打开。令牌会在该浏览器中创建会话 cookie；之后访问 `http://127.0.0.1:3080` 即可。使用 `--no-open` 可启动但不打开浏览器，然后手动打开打印的地址。

```sh
pnpm curupiracode web --no-open
```

要使用 Google Gemini，请安装 Antigravity CLI（Gemini 4 Argon 需要 `agy` 1.4.3 或更高版本），并在终端运行一次 `agy`，用 Google 账号登录。[适配器 README](packages/llm/llm-gemini/README.zh.md) 介绍了模型和设置。

## 系统包含什么

**智能体核心（宿主，Cordis 组合）**

- 本地优先的智能体框架：所有能力都是插件行；宿主进程在无云端依赖的情况下组合注册表、持久化与服务。
- 带完整轨迹的会话、可恢复对话、归档，以及面向长时目标的同会话完成目标。
- 后台子智能体、多智能体工作流编排，以及全新智能体迭代循环。
- 按会话选择的智能体模式：标准、最小、创作者（Cordis）和 PTC，PTC 模式下智能体通过代码调用工具。
- 定时自动任务，以及可在界面中跟踪的后台作业。
- 本地机密的凭据接缝，以及 OAuth 授权流程。
- 带文件访问策略与审批提示的工具沙箱；智能体只申请所需的最小权限。
- 动态插件（`@pluginId`）与插件管理器：在运行中的会话里安装、定义、运行、更新与回滚宿主/客户端代码。

**智能提供方**

- DeepSeek 官方模型，可使用 API key 或 DeepSeek 账号。
- 通过消费级 Google 登录使用 Google Gemini —— 适配器与本地已登录的 Antigravity CLI（`agy`）通信，无需管理任何 API key；目录以 Gemini 4 Argon 开头，Google 账号 OAuth 传输（Code Assist）作为回退。
- 内置目录中的 OpenAI、Anthropic、Kimi 等数十个提供方，以及任意兼容端点，支持按模型的推理力度、重试策略与模型选择器。

**Curupira Memória（第二大脑）**

- 本地知识包：摄取文档、切分段落，并以完整来源信息（文档、片段和偏移）进行搜索。
- 完全保存在本机的 SQLite 存储与内容寻址知识库；重复摄取成本低且不会产生副本。
- 提取 **PDF**、**DOCX**、**HTML** 和纯文本，并可直接读取 Obsidian 知识库。
- 在标准、PTC 和创作者模式中即可使用的 agent 工具，用于摄取文件夹、搜索用户笔记并查找相关资料。

**网络与知识**

- 无需额外密钥的内置搜索：DuckDuckGo（Bing 回退）与 Google 新闻；可选由运维者自控的 SearXNG 实例。
- 通过 HTTP 读取网页，让智能体查阅搜索结果的内容。

**Chrome 与 Edge 扩展**

- 持久化侧边栏聊天，可由用户选择并限量加入当前页面的可见内容。
- 自动化计划经过校验并提供可编辑预览；浏览器只执行用户批准的操作。
- 辅助填写表单但不会自动提交，并阻止密码、验证码、银行卡与文件上传字段。
- 可跨页面录制和回放可移植宏，数据保存在本机，且必须在最终提交前停止。
- 配对在已认证的 CurupiraCode 页面上批准；该代码只能访问不含工具的浏览器对话，并可随时撤销。
- 源代码以及安装与配对说明位于 `apps/browser-extension`。

**网页界面（客户端）**

- `http://127.0.0.1:3080` 上的本地 GUI，以巴西葡萄牙语为主体验，另有英文与中文。
- 右侧边栏提供工作区文件、内置浏览器、终端和文档预览，支持 PDF、电子表格和 Office 文件。
- 模型页提供提供方引导、API key 卡片，以及实时的提供方和模型列表。
- 键盘快捷键、会话日志导出、对话视图、轨迹表与上下文计量。
- CurupiraCode 身份，以及可选的 Cyberpunk Neon 社区主题（[`ui-theme-cyberpunk`](packages/client/ui-theme-cyberpunk/README.zh.md)）。

**命令行**

- `curupiracode web`（及 headless 模式），保留 `dsh` 作为既有脚本的旧别名。

## 项目方向

[路线图](ROADMAP.md)从统一界面开始，现已包含以用户资料为依据的本地第二大脑 Curupira Memória 和浏览器侧边栏扩展。后续将继续扩展 agent 工具兼容性，并开发 ONLYOFFICE、LibreOffice 和 Microsoft Office 扩展。视觉身份和使用规则见 [BRAND.md](BRAND.md)。

## 兼容性与来源

内部命名空间现阶段保持为 `@deepseek-ai/dsh-*`，以便现有生态无需破坏性迁移即可继续加载。未来迁移到独立命名空间时会提供工具和兼容窗口。来源归属和项目独立性见 [NOTICE.md](NOTICE.md)。

## 参与贡献

请阅读 [CONTRIBUTING.md](CONTRIBUTING.zh.md)、[AGENTS.md](AGENTS.md) 和[架构文档](docs/architecture.zh.md)。新集成应以插件形式实现，只申请必要权限，并让用户掌控所有外部操作。

## 引用

CurupiraCode 派生自 DeepSeek Harness；引用其原始架构时请使用：

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## 许可证

[MIT](LICENSE)。第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
