<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" alt="CurupiraCode 标志" />
</p>

# CurupiraCode

[English](README.md) | 中文

**开放的 AI，代码由你掌控。**

CurupiraCode 是一个本地运行、开放且由插件驱动的 AI agent harness。本项目是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的独立派生项目，保留基于 [Cordis](https://github.com/cordiverse/cordis) 的可组合架构，并增加巴西本土身份、葡萄牙语体验以及不绑定单一提供商的集成能力。

## 当前状态

- 使用 CurupiraCode 品牌和本地主题的 Web 界面；
- 巴西葡萄牙语为主要体验；
- 集成无需额外密钥的 DuckDuckGo 搜索、Bing 回退与 Google News；
- 可选通过运营者控制的开源 SearXNG 实例进行搜索；
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

界面默认在 `http://127.0.0.1:3080` 打开。使用 `--no-open` 可启动但不打开浏览器。

```sh
pnpm curupiracode web --no-open
```

## 系统包含什么

**智能体核心（宿主，Cordis 组合）**

- 本地优先的智能体框架：所有能力都是插件行；宿主进程在无云端依赖的情况下组合注册表、持久化与服务。
- 带完整轨迹的会话、可恢复对话，以及面向长时目标的同会话完成目标。
- 后台子智能体、多智能体工作流编排，以及全新智能体迭代循环。
- 本地机密的凭据接缝，以及直接从 UI 发起的 OAuth 授权流程。
- 带文件访问策略与审批提示的工具沙箱；智能体只申请所需的最小权限。
- 动态插件（`@pluginId`）：在运行中的会话里定义、运行、更新与回滚热扩展的宿主/客户端代码。

**智能提供方**

- 开箱即用的 DeepSeek 官方模型。
- 通过消费级 Google 登录使用 Google Gemini —— 适配器与本地已登录的 Antigravity CLI（`agy`）通信，无需管理任何 API key；Google 账号 OAuth 传输（Code Assist）作为企业部署的回退。
- 通过通用提供方接入任意 OpenAI 兼容端点，支持按模型的推理力度、重试策略与模型选择器。

**网络与知识**

- 无需额外密钥的内置搜索：DuckDuckGo（Bing 回退）与 Google 新闻；可选由运维者自控的 SearXNG 实例。
- 知识包：PDF 与文本提取并写入本地段落存储 —— 为本地第二大脑 Curupira Memória 打基础。

**网页界面（客户端）**

- `http://127.0.0.1:3080` 上的本地 GUI，以巴西葡萄牙语为主体验，另有英文与中文。
- 模型页提供提供方引导、会持续轮询直到确认连接的 API key 与登录卡片，以及实时的提供方/模型列表。
- CurupiraCode 身份与官方主题，外加 Cyberpunk Neon 社区主题；对话视图、轨迹表与上下文计量。

**命令行**

- `curupiracode web`（及 headless 模式），保留 `dsh` 作为既有脚本的旧别名。

## 项目方向

[路线图](ROADMAP.md)从统一界面开始，随后推进以用户资料为依据的本地第二大脑 Curupira Memória、带侧边栏的浏览器扩展、agent 工具兼容性以及 ONLYOFFICE、LibreOffice 和 Microsoft Office 扩展。视觉身份和使用规则见 [BRAND.md](BRAND.md)。

## 兼容性与来源

内部命名空间现阶段保持为 `@deepseek-ai/dsh-*`，以便现有生态无需破坏性迁移即可继续加载。未来迁移到独立命名空间时会提供工具和兼容窗口。来源归属和项目独立性见 [NOTICE.md](NOTICE.md)。

## 参与贡献

请阅读 [CONTRIBUTING.md](CONTRIBUTING.zh.md)、[AGENTS.md](AGENTS.md) 和[架构文档](docs/architecture.zh.md)。新集成应以插件形式实现，只申请必要权限，并让用户掌控所有外部操作。

## 许可证

[MIT](LICENSE)。第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
