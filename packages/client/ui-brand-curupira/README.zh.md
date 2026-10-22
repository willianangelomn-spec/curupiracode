---
description: "Web 客户端的 CurupiraCode 品牌占位组件与配色，面向选择品牌展示的用户以及替换它的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-curupira

[English](README.md) | 中文

## 摘要

此包为 Web 客户端提供 CurupiraCode 标识：侧栏和空会话首屏中带有反向足迹的小径回路标志、侧栏标志旁的 **CurupiraCode** 字标，以及两种配色方案下的森林绿强调色和足迹金色琥珀色。它没有运行时状态，也不影响模型请求。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发者备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

CurupiraCode Web 组合包挂载此插件以替代官方品牌包：

```yaml
- id: ui-brand-curupira
  name: '@deepseek-ai/dsh-client-ui-brand-curupira'
```

禁用该行会同时恢复外壳回退内容和默认强调色。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

[`src/client/index.ts`](src/client/index.ts) 通过嵌套的 `ctx.slots.inject()` 占用 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark`，因此占位组件会随声明适应激活顺序和 HMR。配色是覆盖静态 `deepseek` 与 `amber` 色阶的一个 `ctx.theme.overrideTokens()` 层；每个主题都保留自己的表面，而强调色跟随品牌。每个渲染出的标志拥有自己的渐变 id，因为侧栏、导轨和首屏可能同时显示标志。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明侧栏品牌插槽。
- [ui-conversation](../ui-conversation/README.zh.md)——声明首屏品牌插槽。
- [ui-theme](../ui-theme/README.zh.md)——令牌覆盖层。
- [品牌指南](../../../BRAND.md)——CurupiraCode 标识规则。

-----

<a id="model-experience"></a>
## 模型体验

无，此包只提供浏览器展示；这里的内容不会进入模型请求。

#### KV Cache 影响

无；此包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- **浏览器标题独立于此包**——`DSH_CLIENT_TITLE`（此发行版默认为 `CurupiraCode`）在构建时决定标题，不经过插槽系统。

<a id="dev-note"></a>
### 开发者备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
