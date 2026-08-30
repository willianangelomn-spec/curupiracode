<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" alt="CurupiraCode mark" />
</p>

# CurupiraCode

English | [中文](README.zh.md)

**Open AI, code under your control.**

CurupiraCode is a local, open, plugin-first AI agent harness. It is an independent derivative of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), preserves its composable architecture powered by [Cordis](https://github.com/cordiverse/cordis), and adds a Brazilian identity, a Brazilian Portuguese experience, and integrations that do not lock users into one provider.

## Current state

- Web interface with the CurupiraCode identity and local theme;
- Brazilian Portuguese as the primary product experience;
- built-in DuckDuckGo search with Bing fallback and Google News, with no additional key;
- optional SearXNG support through an operator-controlled open-source instance;
- compatibility with `@deepseek-ai/dsh-*` plugins and profiles during the transition;
- `curupiracode` and `dsh` commands, with `dsh` retained as the legacy alias.

The project is in developer preview. APIs and formats may still change.

<a id="run"></a><a id="run-from-source"></a>

## Run this checkout

Install a Node.js version matching the `engines` field in [package.json](package.json), plus pnpm.

```sh
pnpm install
pnpm run build
pnpm curupiracode web
```

The UI opens at `http://127.0.0.1:3080`. Pass `--no-open` to start without opening a browser.

```sh
pnpm curupiracode web --no-open
```

## What's inside

**Agent core (host, Cordis composition)**

- Local-first agent harness: every capability is a plugin row; the host process composes registries, persistence, and services without a cloud dependency.
- Sessions with full trajectory, resumable conversations, and same-session completion goals for long-running objectives.
- Background subagents, multi-agent workflow orchestration, and fresh-agent iterative loops.
- Credential seam for local secrets plus OAuth authorization flows started straight from the UI.
- Tool sandboxing with file-access policies and approval prompts; agents declare the minimum permission they need.
- Dynamic plugins (`@pluginId`): define, run, update, and roll back hot-extended host/client code from the running session.

**Intelligence providers**

- DeepSeek official models out of the box.
- Google Gemini through a consumer Google login — the adapter talks to the locally installed, already-authenticated Antigravity CLI (`agy`), so there is no API key to manage; a Google-account OAuth transport (Code Assist) remains as fallback for enterprise deployments.
- Any OpenAI-compatible endpoint through the generic provider, with per-model reasoning effort, retry policies, and a model picker.

**Web & knowledge**

- Built-in search with no extra key: DuckDuckGo with Bing fallback and Google News; optional SearXNG through an operator-controlled instance.
- Knowledge packages: PDF and text extraction feeding a local passage store — the groundwork for Curupira Memória, the local second brain.

**Web interface (client)**

- Local GUI at `http://127.0.0.1:3080` with Brazilian Portuguese as the primary experience, plus English and Chinese.
- Models page with provider onboarding, API-key and sign-in cards that poll until the connection is confirmed, and live provider/model listing.
- CurupiraCode identity and official theme, plus the Cyberpunk Neon community theme; conversation views, trajectory tables, and context metering.

**Command line**

- `curupiracode web` (and headless mode), with `dsh` kept as a legacy alias for existing scripts.

## Project direction

The Portuguese [roadmap](ROADMAP.md) begins with interface consolidation and continues through Curupira Memória, a local second-brain layer grounded in user materials, a browser side-panel extension, agent-tool compatibility, and extensions for ONLYOFFICE, LibreOffice, and Microsoft Office. See [BRAND.md](BRAND.md) for the visual identity and usage rules.

## Compatibility and origin

Internal namespaces remain `@deepseek-ai/dsh-*` in this phase so the existing ecosystem continues to load without a destructive migration. A future move to a project-owned namespace will include tooling and a compatibility window. See [NOTICE.md](NOTICE.md) for attribution and project independence.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and the [architecture documentation](docs/architecture.md). New integrations should be plugins, request the minimum permissions, and keep users in control of external actions.

## License

[MIT](LICENSE). Third-party dependencies and licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
